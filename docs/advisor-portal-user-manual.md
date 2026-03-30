# Advisor Portal -- User Manual

## Getting Started

### How to Access
1. Log in to Global ERP with your advisor credentials
2. Navigate to **Service Center** > **Advisor Portal** in the sidebar
3. Or go directly to: `/company/{companyId}/pis/advisor-portal`

### What You'll See
The portal shows your name at the top ("Welcome, [Your Name]") and automatically loads your assigned leads, calls, and KPIs.

---

## Dashboard Overview

### KPI Cards (Top Row)
Eight cards showing your real-time performance:

| Card | What It Shows |
|------|---------------|
| **Total Leads** | Number of leads assigned to you |
| **Converted** | Leads you've closed successfully |
| **Car-In** | Cars currently in the workshop |
| **Car-Out** | Cars delivered to customers |
| **Today Collection** | Total AED collected today |
| **Total Revenue** | Your all-time revenue |
| **Total Calls** | Your call count |
| **Answer Rate** | Percentage of calls you answered |

### Tabs
| Tab | Shows |
|-----|-------|
| **Leads** | All your assigned leads |
| **Car-In** | Cars currently in workshop with full workflow status |
| **Car Out** | Delivered cars with invoice details |
| **Customers** | Your assigned customers |
| **Calls** | Your call history |

---

## Step-by-Step Guide

### Step 1: Accepting a Lead

When a car checks in, the system automatically offers you a lead based on your performance score.

**What you'll see:** A yellow banner at the top of the portal:
```
New Lead Offered | TIER 3 (LOW)
Customer: Mohammed Mahdy | 542287649
Vehicle: DXB-B-10123 | VOLKSWAGEN Jetta S
Service: inspection_only
Pipeline Value: AED 0

[Timer: 4:32]  [Accept Lead]
```

**What to do:**
1. Review the customer and vehicle details
2. Click **Accept Lead** before the timer expires
3. If you don't accept in time, the lead goes to the next advisor and you receive a 5-point penalty

**Timer by tier:**
- ELITE (score 80+): 10 minutes
- STANDARD (score 50-79): 7 minutes
- LOW (score below 50): 5 minutes

---

### Step 2: Monitoring the Car-In Dashboard

Click the **Car-In** tab to see all your active cars with workflow status.

**Columns explained:**

| Column | What It Shows | Actions |
|--------|---------------|---------|
| **Customer / Car** | Name, phone, plate, car model | Click name to open lead |
| **Car In Time** | When car checked in | — |
| **Pre-Inspection** | Customer form status | Shows "Submitted" when done |
| **Inspection** | Inspection status | **PDF** button to download report |
| **Estimate** | Estimate status + amount | **View Estimate** or **Create Estimate** |
| **Parts Order** | Parts ordered/received count | **View Parts** opens detail popup |
| **Job Card** | Job progress + stages | **View Job Card** link |
| **Quality** | QC/final inspection status | **View QC Report** opens detail popup |
| **Invoice** | Invoice status + amount | **Pay Now** or **Create Invoice** |
| **Wallet** | Customer wallet balance | **Top Up** button |
| **Delivery** | Gatepass/delivery status | **Create Gatepass** or **Release Car** |

---

### Step 3: Creating an Estimate

**When:** After inspection is completed

**How:**
1. In the Car-In tab, find the car
2. Click **Create Estimate** in the Estimate column
3. The estimate page opens with inspection findings pre-loaded
4. Set pricing for each item (OE/OEM/Aftermarket/Used prices)
5. Click **Save**

---

### Step 4: Viewing Parts Status

**How:**
1. Click **View Parts** button in the Parts Order column
2. A popup shows all parts with:
   - Part name and vendor
   - Quote type (OEM/OE/AFTM/Used)
   - Price
   - Status (Approved/Ordered/Received)
   - Delivery note number and status

---

### Step 5: Viewing QC Report

**How:**
1. Click **View QC Report** button in the Quality column
2. A popup shows:
   - **Final Inspection Checklist**: Test Drive, Cluster Warning, Tyre Check, Computer Reset, Protective Shields, Car Wash (PASS/FAIL)
   - **Inspection Details**: Date/time and inspector name
   - **Remarks**: Any notes from the inspector
   - **Final Inspection Photos**: Front, rear, right, left car photos
   - **Car Out Video**: Link to view
   - **Car Wash**: Status and media

---

### Step 6: Creating an Invoice

**When:** After job card is completed and all parts are received

**How:**
1. Click **Create Invoice** in the Invoice column (or use the estimate page)
2. The **Invoice Verification** modal opens showing:
   - Job card totals
   - Invoice line items (parts)
   - **Service Charges** section:
     - Inspection Fee (default from admin, editable)
     - Labour Charge (editable)
     - Recovery Pickup Fee (if applicable, editable)
     - Recovery Dropoff Fee (if applicable, editable)
   - Subtotal breakdown
   - Discount
   - VAT (5%)
   - **Grand Total**
   - Customer wallet balance
3. Adjust service charges if needed
4. Click **Convert Invoice**

**Service Charges:** These are pre-filled from admin settings but you can edit them before converting. They appear as separate line items on the invoice.

---

### Step 7: Topping Up Customer Wallet

**When:** Customer needs to add funds before payment

**How:**
1. Click **Top Up** button in the Wallet column
2. Fill in the form:
   - **Amount**: Enter the amount in AED
   - **Payment Method**: Cash, Card, Bank Transfer, or Online
   - **Payment Date**: Select the date
   - **Payment Proof**: Upload receipt/proof image
3. Click **Save**
4. Wallet balance updates immediately

---

### Step 8: Paying an Invoice

**When:** Invoice is created and wallet has sufficient balance

**How:**
1. Click **Pay Now** in the Invoice column
2. The **Pay Invoice** modal shows:
   - Invoice number and amount due
   - Wallet balance (green if enough, red if not)
   - Balance after payment
   - If insufficient: shows shortfall amount
3. Click **Confirm Payment**
4. Invoice status changes to **Paid**
5. Wallet balance decreases by the invoice amount

**If wallet is insufficient:** Go back and **Top Up** the wallet first, then pay.

---

### Step 9: Creating a Gatepass

**When:** Invoice is paid

**How:**
1. Click **Create Gatepass** in the Delivery column
2. Gatepass is created automatically
3. Status shows as **Pending**

---

### Step 10: Releasing the Car

**When:** Gatepass is pending, car is ready for handover

**How:**
1. Click **Release Car** in the Delivery column
2. The **Release Car** modal shows:
   - Customer name and vehicle plate
   - Confirmation text (payment, QC, supervisor approval, signature)
   - **Handover Notes** (optional)
3. Click **Confirm Release**
4. Car is released, status changes to **Delivered**
5. Lead is closed

---

### Step 11: Viewing Delivered Cars

Click the **Car Out** tab to see all cars you've delivered:
- Customer name and phone
- Vehicle plate and model
- Invoice number and amount
- Payment status
- Delivery status

---

## Modals Reference

### View Parts Modal
- **Opens from:** Parts Order column > View Parts
- **Shows:** Part name, vendor, type, price, status, delivery note

### View QC Report Modal
- **Opens from:** Quality column > View QC Report
- **Shows:** Inspection checklist, photos, car wash status, video

### Pay Invoice Modal
- **Opens from:** Invoice column > Pay Now
- **Shows:** Amount due, wallet balance, after-payment balance
- **Action:** Confirm Payment (from wallet)

### Top Up Wallet Modal
- **Opens from:** Wallet column > Top Up
- **Shows:** Current balance, amount input, payment method, date, proof upload
- **Action:** Save topup

### Release Car Modal
- **Opens from:** Delivery column > Release Car
- **Shows:** Customer, vehicle, confirmation text, notes
- **Action:** Confirm Release

---

## Tips & Best Practices

### Do's
- Accept leads promptly to avoid penalties and maintain your score
- Check the Car-In tab regularly for workflow updates
- Set accurate service charges before converting to invoice
- Always verify wallet balance before attempting payment
- Add handover notes when releasing car for documentation

### Don'ts
- Don't ignore lead offers -- each timeout costs 5 penalty points
- Don't create invoices before job card is completed
- Don't release cars without verifying payment is confirmed
- Don't modify pricing without advisor approval

### Keyboard Shortcuts
- **Refresh**: Click the Refresh button (top right) to manually reload data
- **Search**: Use the search bar to filter by customer name, phone, or email

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Lead offer expired | Wait for next assignment cycle |
| "Forbidden" error on topup | Contact admin to check permissions |
| Invoice amount wrong | Go to estimate page, adjust pricing, re-create invoice |
| Gatepass creation fails | Ensure invoice is paid first |
| Parts showing "In Progress" | Check parts detail -- may need vendor delivery |
| QC Report empty | Complete final inspection in job card first |
| Wallet balance not updating | Click Refresh button |
| Car Out tab empty | Cars show here after gatepass is released |

---

## Getting Help

- Contact your **Branch Manager** for lead escalations
- Contact **IT Support** for system errors
- Check **AI Coaching** (top right button) for AI-powered performance tips

---

_Version: 1.0 | Date: 2026-03-31 | Global ERP System_
