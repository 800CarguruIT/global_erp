# Global ERP -- Complete User Manual

## Workshop Service Flow: Step-by-Step Guide

_Version: 2.0 | Updated: 2026-03-31_

---

## Before You Start

### Login
1. Go to your Global ERP URL
2. Enter your email and password
3. Select your company
4. You'll land on the company dashboard

### Navigation
- **Sidebar**: Main navigation (Dashboard, Leads, Jobs, etc.)
- **Top Bar**: Language, Theme, Find Customer, Test Panel, Settings
- **Advisor Portal**: Service Center > Advisor Portal

---

## Part 1: Creating a Lead & Booking

### Step 1: Create a New Lead
1. Go to **Leads** page
2. Click **+ CREATE LEAD**
3. Fill in:
   - Customer name and phone (required)
   - Car plate, make, model, year
   - Lead type: **Workshop**
   - Workshop flow: **Inspection** or **Direct Estimate**
4. Click **Save**

### Step 2: Create a Booking
1. Find the lead in the leads list
2. Click **Book** button
3. Confirm lead type (Workshop)
4. Select booking type: **Walk-in** or **Recovery**
5. Set **priority** (Low/Medium/High)
6. Set **scheduled date and time**
7. For recovery: enter pickup and dropoff locations
8. Add notes (optional)
9. Click **Save Booking**

**What happens automatically:**
- Pre-inspection form link is sent to customer (SMS/WhatsApp/Email)
- Lead appears in the queue system

### Step 3: Customer Submits Pre-Inspection Form
The customer receives a link and fills out:
- 8 yes/no questions about the vehicle condition
- Details for any "yes" answers
- Accepts terms and provides digital signature
- After submission, the car appears in the **Check-In Queue**

### Step 4: Car Check-In
At the workshop (via queue system):
1. Select the car from Check-In Queue
2. Take **4 photos**: front, rear, right, left
3. Take **cluster image**
4. Record **360 video**
5. Submit check-in

**What happens automatically:**
- Lead status changes to **Car In**
- Advisor is auto-assigned via PIS scoring

---

## Part 2: Advisor Portal

### Accessing the Portal
Go to **Service Center > Advisor Portal**

### Dashboard Layout
- **KPI Cards (top)**: Total Leads, Converted, Car-In, Car-Out, Today Collection, Total Revenue, Total Calls, Answer Rate
- **Tabs**: Leads, Car-In, Car Out, Customers, Calls

### Accepting a Lead
When a new lead is offered:
1. A **yellow banner** appears at the top with:
   - Customer name and phone
   - Vehicle plate and model
   - Service type
   - Pipeline value
   - **Countdown timer** (5/7/10 minutes based on your tier)
2. Click **Accept Lead** before timer expires
3. If you miss it: 5-point penalty, lead goes to next advisor

### Car-In Tab (Main Workspace)
This is where you manage all your active cars. Each row shows:

| Column | What You See | What You Can Do |
|--------|-------------|----------------|
| Customer/Car | Name, phone, plate, model | Click to open lead |
| Car In Time | When checked in | — |
| Pre-Inspection | Form status | — |
| Inspection | Status + PDF | Download inspection PDF |
| Estimate | Status + amount | View Estimate, Create Estimate |
| Parts Order | Received count + progress | **View Parts** (popup with details) |
| Job Card | Status + stages | **View Job Card** |
| Quality | QC status + wash | **View QC Report** (popup) |
| Invoice | Status + amount | **Create Invoice**, **Pay Now** |
| Wallet | Balance | **Top Up** |
| Delivery | Gatepass status | **Create Gatepass**, **Release Car** |

---

## Part 3: Inspection

### Performing an Inspection
1. Open the inspection from the Car-In dashboard or leads page
2. Complete each step:

**Step 1: Collect Car**
- Review check-in photos/video
- Verify or reject each media item
- Select "No difference" or "Yes, there is a difference"
- Click **Save Collect Car Stage**

**Step 2: Process Checks**
- For each check (Oil, Battery, Tyre, OBD):
  - Select OK / ISSUE / NA
  - Upload check images
- All checks + images required

**Step 3: Vehicle Data**
- Enter/verify: VIN, Car Plate, Make*, Model*, Year* (required)
- Select tyre sizes (front and rear) from dropdown
- Enter mileage
- Use **Decode VIN** to auto-fill from VIN number

**Step 4: Findings**
- Select parts from **category catalog** (Engine, Brakes, etc.)
- For each finding set:
  - Action: Replace / Service / Repair
  - Priority: Safety Risk / Mandatory / Recommended
  - Quantity
  - Upload photo evidence
- AI generates assessment automatically
- Click **Save All** to save all draft items

**Step 5: Complete**
- Review all data
- Click **Complete Inspection**
- Download **PDF** report

---

## Part 4: Estimate & Approval

### Creating an Estimate
1. From advisor portal Car-In tab, click **Create Estimate**
2. Or open inspection and navigate to estimate

### Setting Prices
- Each finding appears as a line item
- Set sale price for each type (OE, OEM, Aftermarket, Used)
- Use **AI Market Pricing** to check competitive rates
- Set status for each item: Pending / Approved / Rejected

### Customer Approval
1. Click **Copy Customer Approval Link** or **Regenerate Link**
2. Share link with customer
3. Customer opens link, reviews items, selects preferences
4. Customer signs and accepts terms
5. Estimate status → **Approved**

---

## Part 5: Parts & Procurement

### Vendor Quotes
Vendors receive inquiries and submit quotes:
1. Enter pricing for each type (OEM/OE/Aftermarket/Used)
2. Select brand for each type
3. Set delivery time
4. Submit quote

Before processing order, vendor must:
1. Click **Complete Details** on the order
2. Enter **Part Number** (required)
3. Upload **Part Diagram** (required)
4. Then **View** becomes available

### Receiving Parts
1. Go to **Procurement** page
2. Open the PO
3. Click **Receive Items** for each delivered part
4. Parts go to **Main Warehouse**
5. GRN (Goods Receipt Note) is automatically created
6. Transfer to workshop branch as needed

---

## Part 6: Job Card

### Job Card Stages
1. **Quote Accepted** → verify quote
2. **Collect Car** → review and approve car media
3. **Pre-Work Check** → enter mileage and confirm car details
4. **Parts Receive** → upload part photos for received parts
5. **Start Job** → begin work
6. **Evidence Upload** → upload working video
7. **Completed** → mark work done
8. **Final Inspection**:
   - Check all items: Test Drive, Cluster Warning, Tyre Check, Computer Reset, Protective Shields
   - Upload 4 car photos (front, rear, right, left)
   - Set Verify/Re-Work for each part
   - Click **Save Final Inspection**
9. **Car Wash**:
   - Upload 5 media (front, rear, right, left, video)
   - Click **Complete Car Wash**

---

## Part 7: Invoice & Payment

### Creating an Invoice
From the advisor portal:
1. Click **Create Invoice** in the Invoice column

Or from the estimate page:
1. Click **Review & Convert**
2. The **Invoice Verification** modal shows:
   - Job card totals
   - Invoice line items (parts)
   - **Service Charges** (editable by advisor):
     - Inspection Fee (default from admin)
     - Labour Charge
     - Recovery Pickup Fee (if applicable)
     - Recovery Dropoff Fee (if applicable)
   - Subtotal breakdown with VAT
   - Grand Total
   - Customer wallet balance
3. Adjust service charges if needed
4. Click **Convert Invoice**

### Topping Up Wallet
1. Click **Top Up** in the Wallet column
2. Enter **Amount** (AED)
3. Select **Payment Method**: Cash / Card / Bank Transfer / Online
4. Select **Payment Date**
5. Upload **Payment Proof** (receipt/document)
6. Click **Save**
7. Balance updates immediately

### Paying an Invoice
1. Click **Pay Now** in the Invoice column
2. Modal shows:
   - Invoice number and amount
   - Wallet balance (green if sufficient, red if not)
   - After-payment balance
   - If insufficient: exact shortfall amount shown
3. Click **Confirm Payment**
4. Wallet is deducted, invoice marked **Paid**

**Important:** If wallet balance is not enough, top up first, then pay.

---

## Part 8: Car Delivery

### Creating a Gatepass
1. After invoice is paid, click **Create Gatepass** in the Delivery column
2. Gatepass created automatically (status: Pending)

### Releasing the Car
1. Click **Release Car** in the Delivery column
2. Modal shows:
   - Customer name and vehicle plate
   - Confirmation checklist
   - Handover notes (optional)
3. Click **Confirm Release**
4. Car is released, lead closes as **Closed Won**
5. Car moves from **Car-In** tab to **Car Out** tab

---

## Part 9: Viewing Delivered Cars

Click the **Car Out** tab to see all delivered cars:
- Customer name and phone
- Vehicle plate and model
- Invoice number and amount paid
- Payment status
- Delivery confirmation

---

## Part 10: Viewing Customers

Click the **Customers** tab to see all your assigned customers:
- Customer name (clickable to dashboard)
- Phone number
- Latest car plate and model
- Lead status
- Number of leads from this customer
- Wallet balance

---

## Reports & Documents

### Available PDFs
| Report | Where to Access |
|--------|----------------|
| Inspection Report | Car-In tab > Inspection > **PDF** |
| Estimate Quote | Estimate page > **Print Quotation** |
| GRN Report | Procurement page > **GRN PDF** |
| Invoice | Invoice column > **Print** |

### QC Report (On-Screen)
1. Click **View QC Report** in Quality column
2. Shows: Final inspection checklist (PASS/FAIL), inspection photos, car wash status, car out video

### Parts Detail (On-Screen)
1. Click **View Parts** in Parts Order column
2. Shows: Part name, vendor, type, price, status, delivery note

---

## Common Tasks Quick Reference

| Task | Where | Action |
|------|-------|--------|
| Accept a lead | Top banner | Click **Accept Lead** |
| View job card | Car-In tab | Click **View Job Card** |
| View parts status | Car-In tab | Click **View Parts** |
| View QC report | Car-In tab | Click **View QC Report** |
| Create estimate | Car-In tab | Click **Create Estimate** |
| Create invoice | Car-In tab or Estimate page | Click **Create Invoice** or **Review & Convert** |
| Top up wallet | Car-In tab | Click **Top Up** |
| Pay invoice | Car-In tab | Click **Pay Now** |
| Create gatepass | Car-In tab | Click **Create Gatepass** |
| Release car | Car-In tab | Click **Release Car** |
| View delivered cars | Car Out tab | Browse table |
| View customers | Customers tab | Browse table |
| Refresh data | Top right | Click **Refresh** |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Lead offer expired | Wait for next cycle or ask manager |
| Can't create estimate | Inspection must be completed first |
| Can't create invoice | Job card must be completed + parts received |
| Can't pay invoice | Top up wallet first |
| Can't create gatepass | Invoice must be paid first |
| Can't release car | Gatepass must exist |
| Wallet not updating | Click **Refresh** button |
| "Forbidden" error | Ask admin to check your permissions |
| Parts showing wrong status | Click **View Parts** for detailed breakdown |
| QC report empty | Complete final inspection in job card first |
| Service charges not showing | Open **Review & Convert** to set them |
| Invoice amount wrong | Adjust pricing in estimate before converting |

---

## Tips for Success

1. **Accept leads quickly** -- every timeout costs 5 penalty points
2. **Monitor Car-In tab** -- it's your main workspace, check it regularly
3. **Set service charges correctly** -- review before converting to invoice
4. **Top up wallet before payment** -- check wallet balance in advance
5. **Use View Parts / View QC** -- stay informed on each job's status
6. **Complete all stages in order** -- the system enforces prerequisites
7. **Use Refresh button** -- data auto-refreshes but manual refresh is instant
8. **Check Car Out tab** -- track your delivered cars and revenue

---

_Global ERP System | Version 2.0 | 2026-03-31_
