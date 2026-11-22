# Direct instance settings and guided setup

The correction after Beta 10 makes the existing guided forms the default inside the
ordinary instance settings. `common.adminUI.config` selects the ioBroker Materialize
entry, `admin/index_m.html`. Its authenticated shared setup is pinned to the selected
instance, opens Guided setup directly and preserves the separate Admin tab. German
and English help explain fields, dropdowns, validation, activation and rollback.

Rooms, manufacturer/source adapters, detected devices, everyday function templates,
source inputs, times, limits and optional SQL are available through forms. Advanced
runtime JSON remains available and edits the same revisioned draft. Existing backend
validation, ownership requirements and disabled new-function defaults remain in force.

Optional native connections live in a separate Technical connections section. Object,
array and null defaults are rendered as valid JSON without changing their native types.
Only changed native fields are passed to Admin's native-save handler; unchanged secrets
and unexposed fields are preserved. The existing Admin handler manages encryption.
Saving native changes can restart the instance and is blocked while a runtime draft is
outstanding. Same-origin, source-checked draft notifications protect pending edits.

An unavailable embedded instance never falls back to another existing instance. Opening,
editing, switching panels, loading the adapter catalogue and validating a draft do not
activate it. Existing revision-conflict and advanced-JSON conflict checks remain unchanged.

Validation includes 214 product tests, fourteen Admin contracts, 59 package checks, build,
typecheck and lint. Real Admin 8.3.11 browser checks on js-controller 7.2.5 exercise the
actual instance route, embedded forms, adapter dropdown, native defaults, unsaved draft
protection, unavailable-instance isolation, German/English and 390/1280 layouts. The
existing three reference workflows also run. Tests use anonymous synthetic devices;
production deployment and physical control acceptance are separate.

Six isolated private installer checks cover UI-only replacement, exact rollback, three
interruption phases, configuration conflict protection and rejection of backend payloads.
The installed runtime and released Beta 10 archive/tag are not silently replaced by a
new release. A scoped private Admin correction, if deployed, has its own file/metadata
backup and evidence; no actor or house-rule change is part of this UI correction.

The live check exposed an additional editor issue: background status refreshes could show
a generic adapter-unavailable/restart message while configuration and catalogue requests
were working. Editing pages now request only their configuration/catalogue. Status polling
is limited to views that need live data, with one in-flight UI request; a failed status
read preserves the draft and reports a status-specific message. Learning input forms are
not redrawn by periodic polling. The browser regression observes a complete real polling
interval and confirms zero status requests during setup. No timeout or source freshness
limit was relaxed.
