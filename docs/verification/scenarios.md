# Acceptance scenarios — software and external evidence

Evidence is separated into unit/contract tests, a real js-controller with synthetic devices, actual
Admin browser workflows, and physical/account checks. No emulator is described as physical hardware.
Reproduction commands are in ../testing.md. Raw logs/screenshots remain private under .local/evidence.

| Scenario | Software evidence | External limit |
| --- | --- | --- |
| S01 Fresh installation | Official testing installs npm tarball; startup and Admin workflow | Frozen release hash is recorded with AP-25 |
| S02 Light only | controller-suite: light-only hot setup and command/report | Physical light pending |
| S03 Named installation | controller-suite: essential circulation survives separate light/context loss | No live water/animal test |
| S04 Climate and air | controller-suite: separate state APIs and room-response evidence | Thermal/device efficacy pending |
| S05 Dynamic binding | AP-26 Admin variant suite changes timezone/count/prefixes/backend mix | Physical combinations pending |
| S06 Extra manufacturer | sdk-controller: LumenLab definition and unchanged light policy | Synthetic SDK manufacturer only |
| S07 One physical writer | configuration tests reject duplicate physical/group/state ownership; arbitration resolves rule conflicts | Operator must verify actual identity |
| S08 Revisions | configuration tests plus controller hot valid/invalid transaction and replay/restart | No external prerequisite |
| S09 Time and DST | configuration tests: overnight anchors, both repeated DST times; strict dated rule bounds | No physical native timer claim |
| S10 Manual priority | executor race test; controller manual/restart; lighting ownership tests | Device-native dial behavior pending |
| S11 Quiet timeout | real five-minute soak on controller, plus deterministic extension test | Synthetic motion/report; actual elapsed time recorded |
| S12 Old timer | lighting and controller restart tests, no old queue replay | Physical restart behavior pending |
| S13 Future motion | faults and controller tests defer then consume slightly future events | No external prerequisite |
| S14 Distinct reasons | policies, normalized quality, executor error allowlist and Admin traces | Unknown device error classes need exact device evidence |
| S15 Failed first audit | executor retry test and independent minimum-service fault test | Real backend outage pending |
| S16 Delayed profile/report | executor tests intermediate/delayed/duplicate values without false human attribution | Native cloud profile-content/device sequence pending; not implemented as schedule writing |
| S17 Native expiry | No native-deadline capability is advertised or simulated as proof | Unsupported until exact backend/model supplies documented expiry + device evidence |
| S18 Source/connection loss | context quality and fault tests; real controller independent essential service | Exact weather/calendar/device outages pending |
| S19 Cloud budget | durable executor quotas, uncertain locks, restart and no-resend tests | Local operator budget is not a vendor quota guarantee |
| S20 Demand vs supply | climate tests and controller trace separate heat request from measured room response | Real heat-source/room efficacy pending |
| S21 Optional channels | all controller/browser runs without channels; incident tests use a configured transport fixture | Actual designated account delivery pending |
| S22 Incident bundling | persisted incident tests across restart, retry, recovery and recipient scope | Real channel acceptance/delivery pending |
| S23 Protected controls | signed sender/user/chat/scope tests; controller expiry/replay/manual tests | Live Telegram requires trusted original-update gateway/account |
| S24 Training basis | chronological full-day holdout, gaps/future rejection; worker training on controller | No household training/savings claim |
| S25 Observe/suggest | adaptation tests passive modes, explicit acceptance and pause/resume | No external prerequisite |
| S26 Bounded | adaptation parameter-only activation and optimizer scope rejection | No external prerequisite |
| S27 Full | actual controller worker training → new rule/parameter plan → command → report → evaluation | Synthetic device effect only |
| S28 Hard bounds | optimizer exclusion/essential rejection, scene bounds and controller essential service | Physical protection remains separately verified |
| S29 Rollback | measured degraded synthetic air input triggers controller rollback; unit preserves newer manual wish | Real causal efficacy pending |
| S30 Model/provider loss | malformed model/budget/replay tests and controller isolation; local HTTP provider budget/failure tests | No paid provider/Ollama account call |
| S31 Untrusted text | strict schema rejection of scripts, arbitrary fields, plugin regex, unknown integration and out-of-scope paths | No free-text code execution exists |
| S32 Isolation | supervisor hung/failing job test, bounded worker training, per-function fault isolation | No long-duration household trial |
| S33 Energy/quality | context metered/integrated coverage tests; plans explicitly estimated | No measured household savings |
| S34 Public artifact | fresh history/author and content scan, whitelist, npm pack, frozen-artifact proof | GitHub, npm and catalog statuses separately reported |
| S35 Admin/language | actual Admin 8.3.11, three references, en/de, keyboard, 1280/390 widths | Browser uses synthetic isolated controller |
| S36 Operations/rollback | controller restart/replay, config persistence rejection/rollback; manual wish preservation | Future incompatible package migration needs its own version test |

S16/S17 cannot be called physical/native-profile successes. This beta supports explicit native
profile selection where mapped, not writing native schedule contents or certified deadline fallback.
Manufacturer fixtures validate exposed contracts only. See ../compatibility.md for exact reviewed
backend versions and ../releasing.md for external publication gates.
