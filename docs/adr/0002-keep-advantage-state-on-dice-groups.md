# Keep advantage state on dice groups

Advantage state belongs to one dice group, not to the roll result as a whole. Every dice group will therefore report a required `advantageState`; `RollResult.advantageState` will be removed. A keep rule that happens to select the same value still reports `normal`, because advantage state records an explicit `adv` or `dis` reading rather than inferring one from the result.

Contextual advantage or disadvantage applies only when the original dice formula contains one dice group with at least two dice. A matching written state is accepted unchanged. A conflicting state, several original dice groups, or a keep rule, bound, or explosion is refused. Signs and group multipliers still compose. Bonus dice groups are appended afterward and do not affect context targeting.

## Considered options

A roll-wide `mixed` state says that readings differed but loses which dice group had which one. A parallel array duplicates the ordering relationship already owned by `dice`. Keeping both roll-wide and group-local fields creates two sources of truth. Applying context to the first eligible group makes mixed dice formulas depend on search order and can silently target a later group the caller did not mean.

## Consequences

This is a breaking TypeScript and JSON result change for 2.0. Callers read advantage state from the relevant dice group instead of the roll result. Mixed formulas retain every group’s reading. Non-normal context no longer adds a die to a one-die group, silently does nothing, or searches several groups for a target; ambiguous and incompatible requests throw before randomness is consumed.
