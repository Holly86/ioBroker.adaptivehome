import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

/** Own data only. Crash leaves a lock; explicit positive stopped-owner proof is required to recover it. */
export class MaintenanceStore<T> {
	private tail: Promise<unknown> = Promise.resolve();
	private constructor(
		private directory: string,
		readonly owner: string,
	) {}
	static async open<T>(
		directory: string,
		recovery?: { expectedLockHash: string; previousOwnerStopped(): Promise<boolean> },
	): Promise<MaintenanceStore<T>> {
		if (!path.isAbsolute(directory)) throw Error('maintenance_absolute_directory_required');
		await fs.mkdir(directory, { recursive: true, mode: 0o700 });
		if ((await fs.lstat(directory)).isSymbolicLink()) throw Error('maintenance_symlink_denied');
		const lock = path.join(directory, 'owner.lock');
		if (recovery) {
			const previous = await fs.readFile(lock);
			if (
				createHash('sha256').update(previous).digest('hex') !== recovery.expectedLockHash ||
				!(await recovery.previousOwnerStopped()) ||
				!(await fs.readFile(lock)).equals(previous)
			)
				throw Error('maintenance_recovery_denied');
			await fs.rename(lock, path.join(directory, `retired-${randomUUID()}.lock`));
		}
		const owner = randomUUID(),
			fd = await fs.open(lock, 'wx', 0o600);
		try {
			await fd.writeFile(owner);
			await fd.sync();
		} finally {
			await fd.close();
		}
		return new MaintenanceStore<T>(directory, owner);
	}
	async read(): Promise<T | undefined> {
		await this.fence();
		try {
			const data = await fs.readFile(path.join(this.directory, 'journal.json'));
			if (data.length > 4 * 1024 * 1024) throw Error('maintenance_journal_too_large');
			return JSON.parse(data.toString('utf8')) as T;
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
			throw e;
		}
	}
	async fence(): Promise<void> {
		if ((await fs.readFile(path.join(this.directory, 'owner.lock'), 'utf8')) !== this.owner)
			throw Error('maintenance_owner_lost');
	}
	async save(value: T): Promise<void> {
		const copy = structuredClone(value);
		await this.serial(() => this.write(copy));
	}
	async update(change: (current: T | undefined) => T | Promise<T>): Promise<T> {
		return this.serial(async () => {
			const next = await change(await this.read());
			await this.write(next);
			return structuredClone(next);
		});
	}
	private serial<R>(work: () => Promise<R>): Promise<R> {
		const next = this.tail.then(work, work);
		this.tail = next;
		return next;
	}
	private async write(value: T): Promise<void> {
		await this.fence();
		const data = JSON.stringify(value);
		if (Buffer.byteLength(data) > 4 * 1024 * 1024) throw Error('maintenance_journal_too_large');
		const temp = path.join(this.directory, `journal-${randomUUID()}.tmp`),
			fd = await fs.open(temp, 'wx', 0o600);
		try {
			await fd.writeFile(data);
			await fd.sync();
		} finally {
			await fd.close();
		}
		await this.fence();
		await fs.rename(temp, path.join(this.directory, 'journal.json'));
		// POSIX directory sync makes the rename durable; Windows doesn't expose directory fsync.
		if (process.platform !== 'win32') {
			const dir = await fs.open(this.directory, 'r');
			try {
				await dir.sync();
			} finally {
				await dir.close();
			}
		}
	}
	async close(): Promise<void> {
		await this.fence();
		await fs.unlink(path.join(this.directory, 'owner.lock'));
	}
}
