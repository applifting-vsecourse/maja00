# Architecture Decision Records

Decisions that are hard to undo or that shape more of the app than one feature. Read the relevant ones before changing the data model or the structure of the app. Add a new ADR (next number, never renumber) when you make such a decision, and mark old ones `Superseded by NNNN` instead of deleting them.

| #                                    | Title                                                   | Status   | Summary                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](0001-anonymous-tombstones.md) | Deleted quacks with replies become anonymous tombstones | Accepted | A quack with replies is not deleted. Its text, mood, author and poll are cleared, so `text` and `userId` are nullable and every quack query must handle tombstones. |
