# Workshop Integration Guide

Workshop partners can push inspection data through the mobile APIs. Key endpoints include `/api/mobile/company/[companyId]/inspections` and `/api/mobile/company/[companyId]/cars`. Combine the JWT bearer token with the `Authorization` header so requests authenticate as a mobile user.

* Use `GET /inspections/[inspectionId]` to fetch details, and `PATCH` to submit line-item updates.
* Manage status changes using the `/cars/[carId]` endpoint when a vehicle progresses through the queue.
* Store partner credentials in the secure vault and rotate them quarterly.
