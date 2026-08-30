# Dice Rolls

opendice reads a dice formula, performs the roll, and reports enough facts for a caller to show and check what happened.

## Language

**Recorded value**:
One entry in a dice group's ordered record. It may be a face a die showed, a bound that competed with the dice, or the adjusted contribution of a penetrating roll.
_Avoid_: Raw roll, face

**Kept marker**:
A yes-or-no fact aligned with one recorded value, saying whether that occurrence contributed to the dice group's total. Position distinguishes equal recorded values.
_Avoid_: Selection guess, kept value
