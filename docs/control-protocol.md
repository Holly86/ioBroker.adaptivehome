# Operation protocol

The authenticated ioBroker Admin transport is the operator. ioBroker ACLs must restrict
Admin access. Mutating requests carry requestId, expectedRevision and expiresAt (max five
minutes). The persistent replay ledger reserves before action and never replays an
uncertain interrupted operation. Manual, rule and learned commands all use Executor.

Optional clients are explicitly configured in technical controlClients with exact sender,
userId, chatId, functions and actions. They send `control` envelopes signed with HMAC-SHA256
using the encrypted controlSecret. Email and Pushover have no control path. The signature
binds all fields including value, expiry and forwarding status. Remote status is scoped.

An optional Telegram gateway may use examples/telegram-gateway.cjs with ORIGINAL Update
objects. It rejects forwarded, edited, expired and incomplete updates before signing.
The public telegram adapter's plain communicate.request/text2command projection does
not preserve sufficient forwarding provenance, so it is deliberately not accepted for
actuation. A trusted original-update gateway must be configured to enable this route;
there is no polling bot, new cloud session or Node-RED dependency in Adaptive Home.
Do not share secrets in support exports or place them in product configuration imports.

Admin changes to scope/clients revoke future operations. New manual wishes invalidate
old learned ownership and are retained during adaptation rollback.
