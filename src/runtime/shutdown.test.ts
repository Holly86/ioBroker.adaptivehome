import { strict as assert } from 'node:assert';
import { unloadAdapter } from './shutdown';

describe('Bounded adapter unload', () => {
	it('closes scheduling before publishing disconnected, without a terminal journal rewrite', async () => {
		const events: string[] = [];
		await unloadAdapter(
			() => events.push('close'),
			async () => events.push('disconnected'),
			() => events.push('warning'),
		);
		assert.deepEqual(events, ['close', 'disconnected']);
	});
	it('finishes even if close throws and the database rejects', async () => {
		let warnings = 0,
			attempted = false;
		await unloadAdapter(
			() => {
				throw Error('synthetic_close_failure');
			},
			async () => {
				attempted = true;
				throw Error('synthetic_db_failure');
			},
			() => warnings++,
		);
		assert.equal(attempted, true);
		assert.equal(warnings, 2);
	});
	it('bounds a nonresponding database well below the legacy host stop budget', async () => {
		let warnings = 0;
		const start = Date.now();
		await unloadAdapter(
			() => undefined,
			() => new Promise(() => {}),
			() => warnings++,
		);
		assert.ok(Date.now() - start < 500);
		assert.equal(warnings, 1);
	});
});
