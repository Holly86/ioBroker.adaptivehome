# Bounded shutdown after Beta 10

## Defect and evidence

A read-only inspection confirmed a host-reported SIGKILL during an instance restart.
The installed backend matched the published Beta 10 backend; the preceding Admin-only
change requested the restart but did not replace backend code. There was no shutdown
stack trace or informational host trace in the retained warning-level log. The exact
latency of that historical shutdown cannot be reconstructed from it.

The pinned js-controller 7.2.5 implementation establishes a concrete deadline defect:

- Without `common.stopTimeout`, the host allows 1,000 ms before SIGKILL.
- The adapter awaited one disconnected-state write and two unsubscribe calls per
  selected data point, for up to 1,000 ms. Hundreds of bindings could generate a
  burst of hundreds of unnecessary database operations during shutdown.
- The controller SDK independently falls back after 500 ms, then needs another
  500 ms before closing its database clients and exiting. A slow unload therefore
  leaves no margin before the host's deadline, even with that SDK fallback.

This is a reproducible failure mechanism consistent with the observed hard stop;
the historical log alone does not prove the duration of each individual DB call.

## Correction

The unload handler stops scheduling and learning work, then allows at most 200 ms
for publishing its disconnected state. It no longer unsubscribes individual patterns
when exiting: the SDK closes the subscriber connections. Selective unsubscribe on
normal live reconfiguration remains in place. Cleanup failures produce a generic
warning and still release the SDK's shutdown callback.

New metadata declares a 3,000 ms host budget, including SDK teardown and scheduling
margin. Correctness is also tested with the legacy 1,000 ms budget; existing instance
objects are not changed by this source correction.

A stopping flag rejects new rounds, operator requests and late device/native dispatch.
Delayed startup cannot create a fresh periodic timer after unload. Pending network
requests already sent before shutdown cannot be recalled; shutdown starts no new
source/backend requests. Journals retain their existing incremental persistence and
recovery contracts. No terminal bulk journal rewrite or device reset is introduced.

## Verification scope

Anonymous regressions exercise the real compiled entry point, cleanup failures,
nonresponding DB calls, delayed startup and late dispatch. Isolated integration uses
the actual js-controller 7.2.5 SDK and databases with 320 synthetic read-only bindings.
A child-process-only fixture simulates nonresponding unsubscribe calls or a stuck
disconnected-state write. A watchdog enforces the real host's deadline; this part is
a host-deadline reproduction, not a running production host daemon.

On 2026-11-23 the uncorrected backend was reproduced with 640 pending unsubscribe
calls and SIGKILL at the legacy host deadline. The final fixture counts calls in
memory and writes a single count after the handler; it does not perform one file
write per subscription or introduce an artificial synchronous I/O burst.

The corrected compiled entry point exited normally (code 11, adapter-requested
termination) in all three controller/DB cases:

| Fault | Host budget | Measured exit | Bulk unsubscriptions |
| --- | ---: | ---: | ---: |
| Nonresponding unsubscribe callbacks | 1,000 ms | 671 ms | 0 |
| Nonresponding disconnected-state write | 1,000 ms | 925 ms | 0 |
| Nonresponding disconnected-state write | 3,000 ms | 808 ms | 0 |

These are measured results, not a timing guarantee under arbitrary process starvation.
The existing restart regression also passed: durable manual priority and replay
records survive, and the device emulator receives no repeated old command. The
controller fixtures contain no cloud connection and issue no device command during
the three shutdown cases. The active configuration record stays byte-identical.

Build/typecheck, 217 TypeScript checks, 14 Admin contracts, four compiled-entry
lifecycle contracts and 59 package checks passed. Public-content review keeps raw
installation logs, identifiers and snapshots out of the product files.

All seven [source CI jobs](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/45082437189)
passed for commit `6c1bbf2c533f43e716d405f765dc2572b05be3b9`: Node 22/24 on Linux,
Windows and macOS, plus build/type/lint and Admin contracts. These checks do not
install the correction in an existing household instance.

The correction is not installed in the household system by this task. Read-only
before/after snapshots matched all 24 adapter/controller process identities, installed
module files, instance configuration, root package metadata, manufacturer pins and
read-hook files. Own HmIP read counters remained unchanged. No live service restart,
actuator command, house-rule change or additional manufacturer-cloud request occurred.
The published Beta 10 tag/archive remain unchanged; this is a source correction.
