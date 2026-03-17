# Company Admin Roles

A company admin typically needs the following permissions:

* `company.dashboard.view`
* `company.users.view` and `company.users.edit`
* `branches.view` and `branches.create` if they manage locations
* `jobs.view` plus `inspections.view` if they run workshops

Roles with `_admin` suffix combine many of these. Use the role builder to add/remove permissions safely and monitor requests from the `monitoring` schema.
