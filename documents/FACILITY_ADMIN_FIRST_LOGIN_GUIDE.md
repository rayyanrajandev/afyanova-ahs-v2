# Facility Admin: First Login to First Patient

**Role:** Facility Administrator (`HOSPITAL.FACILITY.ADMIN`)  
**Goal:** Be ready to register the first real patient.

---

## Step 1 — Log in

1. Go to the app URL and enter your credentials.
2. On successful login you land on the **Dashboard**.
3. In the left sidebar you will see **Setup Center** under the Configuration section.  
   > If the sidebar shows nothing else, that is expected — your role only unlocks full navigation after setup is complete.

---

## Step 2 — Open Setup Center

**URL:** `/setup-center`

This is your control room. It shows a readiness checklist. Work through it top-to-bottom. Do not skip ahead.

---

## Step 3 — Minimum setup before the first patient

You only need these three things before patient registration works. Everything else (billing, inventory, wards) can wait.

### 3a. Confirm the facility profile
- Sidebar → **Setup Center** → *Review facility profile* → `/platform/admin/facility-config`
- Check: facility name, type, timezone, subscription plan, and active status.
- If anything looks wrong, contact the platform super admin — you cannot change facility identity yourself.

### 3b. Create at least one department
- Sidebar → **Setup Center** → *Create departments* → `/platform/admin/departments`
- Click **New Department**.
- Add at minimum: **Reception / OPD** (or whatever the front-desk department is called at your facility).
- Save. The readiness check next to "Departments" turns green.

### 3c. Create at least one service point
- Sidebar → **Setup Center** → *Create service points* → `/platform/admin/service-points`
- Click **New Service Point**.
- Add the reception desk or patient registration counter.
- Save. The readiness check next to "Service Points" turns green.

> **Wards and beds** are only required if your subscription plan includes inpatient / ward management. Skip them if you are doing OPD-only.

---

## Step 4 — Register the first patient

1. In the sidebar click **Patients** → `/patients`
2. Click **Register New Patient** (top-right button).
3. Fill in the required fields:

| Field | Required | Notes |
|---|---|---|
| First Name | Yes | |
| Last Name | Yes | |
| Gender | Yes | male / female / other / unknown |
| Date of Birth | Yes | Must be before today |
| Country Code | Yes | 2-letter ISO, e.g. `TZ` |
| Region | Yes | e.g. Dar es Salaam |
| District | Yes | e.g. Kinondoni |
| Address Line | Yes | Street or ward name |
| Middle Name | No | |
| Phone | No | |
| Email | No | |
| National ID | No | |
| Next of Kin Name | No | |
| Next of Kin Phone | No | |

4. Submit. The system creates the patient record, assigns a patient number, and logs the action against your user account.
5. You will be taken to the patient list. Click the patient row to open their chart.

---

## What happens next

Once the first patient is registered, return to Setup Center and continue with:

- **Staff profiles** — needed before assigning clinicians to appointments or admissions.
- **Clinical catalog** — needed before ordering labs, pharmacy, or radiology.
- **Billable service catalog** — needed before generating invoices.
- **Appointments** → book the first visit for the registered patient.

---

## Quick reference: role permissions

As Facility Administrator you can:
- Read, create, and update patients
- Create and manage departments, service points, staff
- Read all clinical, billing, and inventory records
- Manage service catalog pricing

You **cannot**:
- Change facility identity or subscription (platform super admin only)
- Approve or process billing refunds without the Finance Controller role
- Post pharmacy or lab results (clinical user roles required)
