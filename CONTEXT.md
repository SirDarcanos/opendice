# Dice Rolls

opendice reads a dice formula, performs the roll, and reports facts a caller can show and check. The caller decides what those facts mean.

## Language

**Dice formula**:
Text that names at least one die and may say how to read the dice, add modifiers, or attach a recognised tag.
_Avoid_: Expression, command

**Roll result**:
The factual record produced from one dice formula, including the recorded values, what counted, and the arithmetic behind the total.
_Avoid_: Outcome, ruling

**Dice group**:
One set of dice in a formula that shares a side count, sign, and way of being read. A formula may contain several dice groups.
_Avoid_: Roll, pool

**Face**:
The number a die showed. A face is distinct from a bound and from the adjusted value recorded for an extra penetrating roll.
_Avoid_: Recorded value, result

**Recorded value**:
One entry in a dice group's ordered record. It may be a face, a bound that competed with the dice, or a penetrating contribution.
_Avoid_: Raw roll, face

**Kept value**:
A recorded value selected to contribute to its dice group's total. Equal kept values may refer to different occurrences in the record.
_Avoid_: Face, kept marker

**Kept marker**:
A yes-or-no fact aligned with one recorded value, saying whether that occurrence contributed to the dice group's total. Position distinguishes equal recorded values.
_Avoid_: Selection guess, kept value

**Keep rule**:
A way of reading a dice group that keeps a stated number of its highest or lowest faces. Earlier dice win when equal faces meet the cutoff.
_Avoid_: Bound

**Bound**:
A minimum or maximum value that competes with dice instead of rewriting their faces. A bound may compete with each die separately or with the group's sum.
_Avoid_: Modifier, replacement face

**Natural high**:
The fact that a dice group kept exactly one value and that value came from a die showing its highest face. A matching bound does not create a natural high.
_Avoid_: Critical result, success

**Natural low**:
The fact that a dice group kept exactly one value and that value came from a die showing 1. A matching bound does not create a natural low.
_Avoid_: Failure

**Explosion chain**:
The ordered record that begins with one roll of a die and continues with another roll each time the die shows its highest face. Every recorded value in the chain counts.
_Avoid_: Reroll

**Penetrating contribution**:
The recorded value of an extra roll in a penetrating explosion chain, worth one less than the face shown. The face still decides whether the chain continues.
_Avoid_: Face, penalty

**Modifier**:
A whole number added to or subtracted from the dice groups in a roll. It is reported separately from the dice.
_Avoid_: Bonus, dice group

**Group multiplier**:
A whole number applied to one dice group's kept values. It does not multiply modifiers or other dice groups.
_Avoid_: Modifier

**Tag**:
A trailing word the caller has chosen to recognise as metadata. It never changes how the dice are read or totalled.
_Avoid_: Roll kind, rule
