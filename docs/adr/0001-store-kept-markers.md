# Store kept markers on dice groups

A kept marker cannot always be reconstructed from `results` and `kept`: equal recorded values may come from different dice or bounds, and only one occurrence may count. Each dice group will therefore store one required `keptFlags` entry per recorded value while keeping `results` and `kept` flat and unchanged.

## Considered options

Matching equal numbers after the roll loses occurrence identity and already marks the wrong entries for some per-die bounds. Replacing each recorded number with a larger record would preserve identity but break the simple, flat result. Stored kept markers preserve both the truth of the roll and the existing result shape.

## Consequences

This is a breaking TypeScript and JSON result change planned for 2.0.0, but it will land under **Unreleased** without triggering a release. The existing `keptFlags(group)` helper remains supported and uses best-effort matching only for old objects that have no stored markers.
