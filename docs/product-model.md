# Product model

Groups are freely named rooms or installations. A function references selected capability
bindings and inputs; a device may supply several independent capabilities. Physical
identity and confirmed ownership, not a brand name, determine the one writer.

The catalog in src/model/product.ts declares minimum capabilities and scenario links.
Missing optional capabilities stay unknown. Native schedules/deadlines require explicit
backend and device support; software schedules remain available independently.

Operating modes: automatic (configured schedules/rules), demand (fresh sensors),
continuous (the configured minimum service), maintenance (no normal automatic writes).
Verified technical protection may override a minimum service. Human intervention
pauses lower-priority automation for the configured hold. Hard limits are always checked.

All five learning modes are beta-core. Classic does not train; observe only measures;
suggest requires acceptance; bounded changes granted parameters; full also builds and
activates granted declarative rule combinations. No generated scripts are accepted.

The three executable example configurations will use the same schema and engine:
apartment (motion lighting and climate), aquarium (continuous circulation plus timed
light), air quality area (demand fan). They do not require notification or AI accounts.
The first vertical path is binding confirmation → function setup → validated revision
→ executor → feedback → explanation. Backend-specific hardware claims remain separate.

Every target is linked to the S01–S36 acceptance cases in implementation/ACCEPTANCE.md;
case results must identify unit/contract, controller, browser, or physical evidence.
