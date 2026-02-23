# API Status Dictionary

## Version

- Version: v1
- Last updated: 2026-02-23

## Leads

| Status | Meaning | Allowed Next |
| --- | --- | --- |
| new | Newly created lead | assigned, under_inspection, cancelled |
| assigned | Assigned to team/user | under_inspection, cancelled |
| under_inspection | Inspection started | estimate_pending, cancelled |
| estimate_pending | Waiting estimate approval | in_progress, cancelled |
| in_progress | Work execution started | ready_for_delivery, waiting_parts |
| waiting_parts | Waiting for parts | in_progress, cancelled |
| ready_for_delivery | Ready for handover | delivered |
| delivered | Car out/delivered | closed |
| closed | Fully closed | - |
| cancelled | Cancelled case | - |

## Inspections

| Status | Meaning | Allowed Next |
| --- | --- | --- |
| pending | Created, not started | in_progress, cancelled |
| in_progress | Inspection underway | pending_review, completed |
| pending_review | Awaiting review | approved, rejected |
| approved | Approved findings | converted_to_estimate, closed |
| rejected | Needs correction | in_progress |
| completed | Completed inspection | approved, closed |
| closed | Finalized | - |

## Estimates

| Status | Meaning | Allowed Next |
| --- | --- | --- |
| draft | Working draft | pending_approval, cancelled |
| pending_approval | Waiting approval | approved, rejected |
| approved | Approved for execution | converted_to_job_card, closed |
| rejected | Rejected estimate | revised, cancelled |
| revised | Updated after rejection | pending_approval |
| converted_to_job_card | Converted into job card | closed |
| closed | Finalized | - |
| cancelled | Cancelled | - |

## Job Cards

| Status | Meaning | Allowed Next |
| --- | --- | --- |
| Pending | Created, awaiting assignment/start | Re-Assigned, In Progress, Cancelled |
| Re-Assigned | Reassigned to another executor | In Progress, Cancelled |
| In Progress | Execution underway | Waiting for Parts, Completed |
| Waiting for Parts | Blocked on parts | In Progress |
| Completed | Work completed | Closed |
| Closed | Fully closed | - |
| Cancelled | Cancelled | - |

## Procurement

| Status | Meaning | Allowed Next |
| --- | --- | --- |
| pending | Request/PO pending | approved, ordered, cancelled |
| approved | Approved for order | ordered |
| ordered | Order issued | partially_received, received |
| partially_received | Partial receive | received |
| received | Fully received | closed |
| closed | Closed cycle | - |
| cancelled | Cancelled cycle | - |

## Inventory Movement

| Status | Meaning | Allowed Next |
| --- | --- | --- |
| available | Available for issue | reserved, issued |
| reserved | Reserved for job | issued, available |
| issued | Issued to operation | closed |
| in_transit | Transfer in progress | received |
| received | Transfer/receipt complete | available |
| adjusted | Manually adjusted | available |
| blocked | Not usable stock | available |
