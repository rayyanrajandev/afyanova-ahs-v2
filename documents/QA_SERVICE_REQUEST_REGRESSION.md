# QA — Walk-in service requests (regression matrix)

Manual pass after touching service requests, permissions, patient list, or handoff UI.

| # | Scenario | Actor | Steps | Expected |
|---|----------|-------|-------|----------|
| 1 | Create queue ticket | Registration / Nursing (`service.requests.create`) | Patients → Visit hand-off → Direct services → Send to Lab | **201**, toast + “What happened” shows request number |
| 2 | Idempotent UX | Same | Tap same department button again after success | Disabled / no duplicate API call |
| 3 | Department sees patient | Lab / Pharm / Imaging (`service.requests.update-status`) | Open module walk-in panel | Patient listed **pending**, acknowledge moves to **in_progress** |
| 4 | Optional visit link | Same + active OPD visit | Create ticket while visit hand-off sees active appointment | Persisted **`appointment_id`** on row (Facility Admin/API) |
| 5 | Patient list badge | User with **`patients.read`** only | Feature flag **`clinical.walk_ins.routing_summary_on_patient_list`** = on | **`routingHandoffSummary`** populated on index row when SR active |
| 6 | Flag off | Same | Toggle flag off via platform overrides | Summaries omit unless **`service.requests.read/create`** held |
| 7 | Supervisor export | Facility Admin (`service.requests.export`) | `GET /api/v1/service-requests/export/csv?...` | UTF-8 CSV stream |
| 8 | Audit trail | Facility Admin (`service.requests.audit-logs.read`) | Create SR + PATCH status → `GET .../{id}/audit-events` | **created** + **status_updated** events |
| 9 | POS coherence | Cashier | Lab quick OTC / unrelated POS flows | Unaffected; settlements remain on **`pos_sales`**, see `documents/WALK_IN_SERVICE_REQUESTS_VS_POS.md` |

Automated subset: **`tests/Feature/ServiceRequest/ServiceRequestWalkInApiTest.php`**.
