import { deadline } from './clock';

// The controller still needs time to publish alive=false, flush logs and close its DB clients.
// Subscriptions belong to those clients and are released by their connection teardown.
export async function unloadAdapter(
	close: () => void,
	disconnect: () => Promise<unknown>,
	warn: () => void,
): Promise<void> {
	try {
		close();
	} catch {
		warn();
	}
	try {
		await deadline(Promise.resolve().then(disconnect), 200);
	} catch {
		warn();
	}
}
