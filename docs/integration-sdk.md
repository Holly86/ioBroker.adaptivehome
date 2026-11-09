# Integration SDK v1

The preferred extension is a declarative JSON profile. See
examples/integrations/lumenlab.json for an independent synthetic manufacturer.
No executable plugin, URL download or model-generated script is loaded.

1. Name an integration id and the existing ioBroker backend prefixes.
2. Declare reviewed supportedVersions. List exact suffixes, raw type, unit, scale,
   and read-only status. The backend must expose actual permissions.
3. Run `npm run build` and `node scripts/validate-integration.cjs profile.json`.
4. Run the shared `runIntegrationContract` with synthetic state/metadata fixtures.
5. Install the profile in the adapter instance's technical `integrationProfiles`
   setting. Only the operator controls this list; learning cannot change it.
6. Discover, confirm physical identity and exclusive ownership, select exact
   write/feedback paths, limits and purpose in the Admin. Discovery never authorizes.

The package exports `iobroker.adaptivehome/sdk` and `/contracts`. More involved
trusted code integrations may contribute an IntegrationManifest in source: discovery
receives selected metadata and returns binding proposals. Reading/subscription,
normalization, dispatch, feedback, quotas and failure handling remain shared core
services. An integration receives no arbitrary state-write port or model journal.

API v1 also accepts an optional second discovery argument, `{ resources }`, keyed by parent object ID.
Each resource contains only `role`, native `type` and native `id`; instance credentials and other native
configuration are never included. Older one-argument profiles continue to work. Resource-aware profiles
must scope resource IDs by backend instance and kind, and reject ambiguous aliases and aggregates.
Declarative rules may add `sourceUnit` for exact raw-unit matching before `scale`; `unit` is the normalized
unit. If omitted, the raw unit must equal `unit`. A scale does not authorize arbitrary source units.

Physical identity must identify each actual output, including channel. Aggregates must
declare all memberPhysicalIds and must not include excluded devices. Normalize into
capabilities without assigning a user's semantic function. Preserve source type/unit
and conversion; specify raw enumerations with valueMap and allowed values. Unmapped
codes are invalid. Only explicitly documented device feedback warrants device proof;
same-state ack is backend evidence. No native schedule/deadline is inferred from a relay.

API major mismatches, unknown fields, duplicate registrations, incompatible units,
missing confirmations and out-of-backend paths are rejected. Migrate definitions
explicitly for a new API major; v1 has no automatic permissive migration. A new
capability must document unit/type/quality semantics and policies that can consume it.
Do not reuse actual installation identifiers or publish raw evidence in fixtures.

Beta-4 additive v1 contracts are described in [policy-parity.md](policy-parity.md).
Explicit mappings can select device-scoped read evidence and a separate event
timestamp. `writeValues` limits commands without invalidating readable feedback.
RGBW components have separate declared mappings and require all feedback.
The SDK exports `nativeHeatingProgramSchema`, `nativeHeatingReportSchema`,
`parseNativeHeatingReport`, `compileNativeHeatingProgram` and `NativeHeatingProgram`
for the finite native-heating extension. A conforming backend must actually
provide correlated full-content feedback, automatic activation and autonomous
absolute expiry/fallback. These exports do not supply a vendor transport or
establish standard hmip support. Never set backend verification from schema
validation alone; keep unsupported configurations disabled.
