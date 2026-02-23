# Cars Management

## Vehicle Setup & Operational Control Guide

---

## Who Should Read This?

* Company Administrators
* Operations Managers
* Service Advisors and Workshop Supervisors
* Security or IT Administrators supporting access

---

# 1. What Is Cars Management?

Cars Management is the area where company-level teams manage vehicle records used across inspections, job cards, workshop execution, and billing.

Primary page path:

`/company/[companyId]/cars`

Each car profile is a master operational record linked to customer activity and service history.

---

# 2. What Can You Do on This Page?

Through Cars Management, you can:

* View all car records
* Create new car profiles
* Edit existing car details
* Activate or deactivate cars
* Maintain clean vehicle master data
* Open Car Dashboard for vehicle-specific history and context

This ensures operations use accurate and traceable vehicle data.

---

# 2.1 Car Dashboard

From the cars list, authorized users can open the Car Dashboard for a selected vehicle.

The Car Dashboard is used to:

* View vehicle profile summary
* Review service and job history
* Check current operational status
* Access related workflows quickly

Use it before creating or updating operational records for that vehicle.

---

# 3. Why Cars Management Is Important

Strong vehicle data control helps your company:

* Reduce duplicate vehicle records
* Improve job accuracy and planning
* Ensure correct customer-to-vehicle mapping
* Protect reporting and billing integrity
* Maintain full operational traceability

---

# 4. A. Viewing and Searching Cars

## What Information Is Typically Visible

* Plate number
* VIN or chassis number (if available)
* Make, model, and year
* Linked customer
* Operational status (Active / Inactive)
* Last service activity (if available)

---

## Why This Matters

This allows administrators and operations teams to:

* Confirm if a vehicle already exists
* Validate ownership and profile quality
* Identify inactive or outdated records
* Support audit and service history checks

---

# 5. B. Creating a New Car

## When to Create a Car

Create a car record when:

* A new customer vehicle is onboarded
* A first-time inspection is initiated
* A vehicle has no existing profile in the system

---

## Required Information

When creating a car, provide:

* Plate number
* VIN/chassis number (if required)
* Make and model
* Year
* Linked customer
* Optional notes or identifiers
* Status (normally Active)

---

## Example Setup Flow

1. Open Cars page
2. Click Add Car
3. Enter vehicle details
4. Link the correct customer
5. Set status to Active
6. Save

---

## Post-Creation Validation

After creation, confirm:

✔ Car appears in list  
✔ Plate/VIN uniqueness is preserved  
✔ Customer linkage is correct  
✔ Car is available in inspections and jobs  
✔ Data appears correctly in dashboard view

---

# 6. C. Editing an Existing Car

## When Should You Edit a Car?

* Plate or VIN data correction
* Customer linkage update
* Model/year detail correction
* Profile cleanup for operational accuracy

---

## What Can Be Updated?

* Plate number
* VIN/chassis number
* Vehicle make/model/year
* Linked customer
* Profile metadata and notes
* Status

After editing, verify updates are reflected in list, dashboard, and downstream workflows.

---

# 7. D. Managing Car Status (Active / Inactive)

## When to Deactivate a Car

* Vehicle no longer serviced by company
* Duplicate was merged into a valid profile
* Invalid or retired vehicle record

---

## Why Deactivate Instead of Delete?

Deactivation is preferred because it:

* Preserves service and job history
* Maintains billing and reporting references
* Keeps audit trail intact
* Prevents new operations on inactive vehicles

Deleting car records can break operational and financial traceability.

---

## Reactivating a Car

If the vehicle returns to service:

* Change status to Active
* Validate customer linkage
* Confirm availability in operational modules

---

# 8. E. Operational Validation Checklist

After create/edit/status changes, confirm:

✔ Car appears correctly in list  
✔ Plate/VIN and profile fields are accurate  
✔ Customer mapping is valid  
✔ Active cars are available in workflows  
✔ Inactive cars are blocked from new operations  
✔ Related reports remain consistent

---

# 9. Security & Operations Control Principles

For controlled vehicle administration:

* Limit car create/edit permissions to authorized roles
* Enforce uniqueness rules for plate and VIN fields
* Review inactive and duplicate vehicles regularly
* Record major profile changes for audits
* Apply least-privilege access

---

# Executive Summary

Cars Management allows company teams to:

* Maintain clean and accurate vehicle records
* Link vehicles correctly to customers
* Control operational status
* Preserve service and transaction traceability

It is a core operational data layer for reliable inspections, jobs, and billing in the Global ERP platform.
