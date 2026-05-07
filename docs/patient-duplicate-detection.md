# Patient Duplicate Detection Rules

Patient registration is designed for Tanzania workflows where families may share phone numbers, some patients do not have NIDA, and babies may not have any national identifier.

## Hard Blocks

Registration or update is blocked only when an active patient already has the same hard identifier:

- National ID/NIDA, normalized by removing spaces and punctuation.
- Patient number/MRN, normalized by removing spaces and punctuation.
- Insurance/member ID only when a payer configuration explicitly marks that identifier as unique.

Phone numbers are not hard identifiers.

## Warnings

When no hard identifier matches, registration is allowed and possible duplicates are returned as warnings for staff review.

Confidence score:

- Same first name: 20
- Same last name: 20
- Same date of birth: 30
- Same phone: 15
- Same gender: 10
- Same address: 10

Thresholds:

- 80 or higher: strong duplicate warning.
- 50 to 79: possible duplicate suggestion.
- Below 50: no duplicate warning.

## Tanzania-Specific Handling

- Shared family phone numbers are allowed.
- Same phone only does not block registration and does not warn unless other demographics raise the score to 50 or higher.
- Same name and date of birth with a different phone is never a hard block.
- Patients without NIDA use demographic scoring only.
- Babies and children without IDs can be registered; review warnings instead of merging records automatically.

Staff should review possible matches before continuing, but the system must avoid automatic merges and false-positive blocks unless a hard identifier matches.
