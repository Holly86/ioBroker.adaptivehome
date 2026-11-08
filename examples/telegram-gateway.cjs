// Integration helper for an explicitly trusted gateway receiving ORIGINAL Telegram Update objects.
// Never reconstruct these fields from a forwarded text or communicate.request string.
const { createHmac } = require('node:crypto');
function controlFromUpdate(update, { clientId, functionId, action, value, revision, secret, now = Date.now() }) {
	const msg = update.message;
	if (
		!msg?.from ||
		!msg.chat ||
		msg.forward_origin ||
		msg.forward_date ||
		msg.forward_from ||
		msg.edit_date ||
		typeof update.update_id !== 'number'
	) {
		throw new Error('Original non-forwarded update required');
	}
	if (Math.abs(now - msg.date * 1000) > 30000) {
		throw new Error('Stale update');
	}
	const envelope = {
		clientId,
		requestId: `telegram-${update.update_id}`,
		expectedRevision: revision,
		expiresAt: now + 30000,
		functionId,
		action,
		value,
		userId: String(msg.from.id),
		chatId: String(msg.chat.id),
		forwarded: false,
	};
	const content = JSON.stringify([
		clientId,
		envelope.requestId,
		revision,
		envelope.expiresAt,
		functionId,
		action,
		value ?? null,
		envelope.userId,
		envelope.chatId,
		false,
	]);
	return { ...envelope, signature: createHmac('sha256', secret).update(content).digest('hex') };
}
module.exports = { controlFromUpdate };
