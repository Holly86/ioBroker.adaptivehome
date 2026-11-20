# Guided Admin setup after Beta 8

The development version adds an everyday setup path alongside the existing detailed
forms. Rooms/installations, time zones, concrete installed adapter instances,
discovered devices, compatible sensor/output selections, motion holds in minutes,
temperature/air targets, weekly schedules and optional SQL settings use fields and
dropdowns. Only templates matching prepared output capabilities are offered.

Installed-adapter metadata is returned through the existing Admin authorization
boundary, without native credentials. Discovery can be scoped to one exact installed
backend instance; it reads object descriptions rather than starting services or
probing actuators. Optional trusted integration profiles extend the adapter list.
Localized parent/state names can be used as editable device labels. The optional
binding `name` is additive for existing configurations; older packages need a
compatible configuration backup when rolling back.

Read-only imports remove write mappings. Preparing a writable binding requires an
explicit identity/feedback/ownership review. New everyday functions remain disabled
with classic rules and no learning permission. Known physical/group intersections,
duplicate function ownership, unsuitable types, OFF-only simple outputs and native
profile transports are not silently converted into simple control templates.

The advanced JSON editor uses the same complete draft and server-side validation as
the forms. Invalid syntax/schema retains the existing draft. Pending JSON edits
block footer activation; stale JSON cannot overwrite intervening form edits.
Successful transfer updates the forms without activating the draft. Existing
revision conflict checks still apply at activation.

The package includes detailed German/English setup guides and an offline Admin help
page. The instance settings explain where to find the ordinary form-based workflow.
Private device IDs, recipients and credentials remain outside public examples.

## Verification

- Build, TypeScript check and repository lint passed.
- 205 unit/contract checks and 61 standalone package checks passed, including new safe metadata,
  scoped discovery, label, read-only import, ownership/alias and four-template checks.
- 17 isolated js-controller checks passed, including the actual Admin browser flow
  and the three existing reference configurations.
- A focused actual-Admin rerun passed after extending the browser checks: German and
  English, keyboard use, 1280/390-pixel layouts, dynamic template filtering, SQL
  selection, offline help, invalid JSON, stale JSON and advanced-setting preservation.
- The browser saved the newly prepared function disabled and verified that the
  synthetic output state remained acknowledged. No physical device was involved.
- Package inventory includes the new Admin helper/help and both detailed guides.

The first broader browser run exposed a test-navigation assumption after the new
guided flow: the pre-existing test expected Overview while the helper had left the
page at Import & channels. Explicit test navigation corrected it; the subsequent
full and focused runs passed. Raw synthetic browser evidence remains ignored.

The initial CI package job also exposed an order dependency in the new test wiring:
it runs package checks before compiling runtime files. Draft contracts now run in a
separate Admin test command with an explicit build step, also invoked by CI;
standalone package checks require no build directory. The 205 contract checks consist
of 195 TypeScript checks and ten Admin draft checks.

These are development and isolated software checks. The published Beta-8 artifact,
production adapter, manufacturer adapters, existing house rules and actuators were
not changed. No new release, registry publication, physical expiry/manual-priority
acceptance or production cutover is claimed. Private source availability and the
long-term observation are tracked separately.
