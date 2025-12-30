import { NextRequest, NextResponse } from "next/server";
import { Crm, CrmTypes, Leads } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  try {
    const data = await Leads.listLeadsForCompany(companyId);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET leads failed", err);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "crm.leads", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const actorUserId = await getCurrentUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const customerPayload = body?.customer ?? {};
    const carPayload = body?.car ?? {};

    const leadType = normalizeLeadType(body?.leadDivision ?? body?.leadType);
    const leadSource = body?.leadCategory ?? null;
    const customerName = (customerPayload?.name ?? "").trim();
    const customerPhone = formatPhone(customerPayload?.phoneCode, customerPayload?.phoneNumber);
    const whatsappPhone = formatPhone(customerPayload?.whatsappPhoneCode, customerPayload?.whatsappPhoneNumber);
    const customerEmail = (customerPayload?.email ?? "").trim() || null;

    if (!customerName && !customerPhone && !customerEmail) {
      return NextResponse.json({ error: "Customer name or contact is required" }, { status: 400 });
    }

    const existingCustomer = await findExistingCustomer(companyId, customerPhone, customerEmail);
    const customer =
      existingCustomer ??
      (await Crm.createCustomer({
        companyId,
        customerType: "individual",
        name: customerName || "Customer",
        phone: customerPhone || null,
        whatsappPhone: whatsappPhone || null,
        email: customerEmail,
      }));

    let carId: string | null = null;
    const carInput = buildCarInput(companyId, carPayload);
    const hasCarDetails = Boolean(carPayload?.id || carHasDetails(carInput));

    if (carPayload?.id) {
      try {
        await Crm.updateCarRecord(String(carPayload.id), carInput);
        carId = String(carPayload.id);
      } catch (err) {
        console.error("Update existing car failed, will create a new car instead", err);
      }
    }

    if (!carId && hasCarDetails) {
      const car = await Crm.createCar(carInput);
      carId = car.id;
    }

    if (carId) {
      try {
        await Crm.linkCustomerToCar({
          companyId,
          customerId: customer.id,
          carId,
          relationType: "owner",
          isPrimary: true,
        });
      } catch (err) {
        console.error("Link customer to car failed", err);
      }
    }

    const lead = await Leads.createLead({
      companyId,
      customerId: customer.id,
      carId,
      agentEmployeeId: body?.assignTo ?? null,
      leadType,
      source: leadSource,
      leadStage: "new",
    });

    if (body?.agentRemarks || body?.customerRemarks) {
      await Leads.updateLeadPartial(companyId, lead.id, {
        agentRemark: body?.agentRemarks ?? undefined,
        customerRemark: body?.customerRemarks ?? undefined,
      });
    }

    await Leads.appendLeadEvent({
      companyId,
      leadId: lead.id,
      eventType: "created",
      eventPayload: {
        leadType,
        leadSource,
        assignedTo: body?.assignTo ?? null,
      },
      actorUserId,
    });

    const enriched = await Leads.getLeadById(companyId, lead.id);
    return NextResponse.json({ data: enriched ?? lead }, { status: 201 });
  } catch (err) {
    console.error("POST leads failed", err);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "crm.leads", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;
  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x)) : [];
    const action = body?.action === "delete" ? "delete" : "archive";
    if (ids.length === 0) {
      return NextResponse.json({ error: "No leads selected" }, { status: 400 });
    }
    if (action === "archive") {
      for (const id of ids) {
        await Leads.updateLeadPartial(companyId, id, { isArchived: true });
      }
      return NextResponse.json({ message: "Leads archived", ids });
    }
    for (const id of ids) {
      await Leads.deleteLead(companyId, id);
    }
    return NextResponse.json({ message: "Leads deleted", ids });
  } catch (err) {
    console.error("Bulk delete/archive leads failed", err);
      return NextResponse.json({ error: "Failed to update leads" }, { status: 500 });
  }
}

function formatPhone(code?: string | null, number?: string | null): string {
  return `${code ?? ""}${number ?? ""}`.replace(/\s+/g, "");
}

async function findExistingCustomer(companyId: string, phone: string | null, email: string | null) {
  const normalizedPhone = normalizePhoneDigits(phone);
  const searchKey = phone || email;
  if (!searchKey) return null;

  try {
    const candidates = await Crm.listCustomers(companyId, { search: searchKey });
    for (const c of candidates) {
      if (email && c.email && c.email.toLowerCase() === email.toLowerCase()) {
        return c;
      }
      const candidatePhone = normalizePhoneDigits((c as any).phone);
      if (normalizedPhone && candidatePhone && candidatePhone === normalizedPhone) {
        return c;
      }
    }
  } catch (err) {
    console.error("findExistingCustomer failed", err);
  }
  return null;
}

function normalizeLeadType(raw?: string | null): "rsa" | "recovery" | "workshop" {
  const val = (raw ?? "").toLowerCase();
  if (val === "recovery" || val === "workshop") return val;
  return "rsa";
}

function buildCarInput(companyId: string, raw: any): CrmTypes.CreateCarInput {
  const modelYear = parseNumber(raw?.year ?? raw?.modelYear);
  const mileage = parseNumber(raw?.mileage);
  return {
    companyId,
    plateCode: nullIfEmpty(raw?.plateCode),
    plateNumber: nullIfEmpty(raw?.plateNumber),
    plateCountry: nullIfEmpty(raw?.plateCountry),
    plateState: nullIfEmpty(raw?.plateState),
    plateCity: nullIfEmpty(raw?.plateCity),
    plateLocationMode: raw?.plateLocationMode ?? null,
    vin: nullIfEmpty(raw?.vin),
    vinPhotoFileId: nullIfEmpty(raw?.vinPhotoFileId),
    make: nullIfEmpty(raw?.make),
    model: nullIfEmpty(raw?.model),
    modelYear,
    mileage,
    tyreSizeFront: nullIfEmpty(raw?.tyreSizeFront),
    tyreSizeBack: nullIfEmpty(raw?.tyreSizeBack),
    registrationExpiry: nullIfEmpty(raw?.registrationExpiry),
    registrationCardFileId: nullIfEmpty(raw?.registrationCardFileId),
  };
}

function carHasDetails(input: CrmTypes.CreateCarInput): boolean {
  return Boolean(
    input.plateNumber ||
      input.plateCode ||
      input.vin ||
      input.make ||
      input.model ||
      input.modelYear ||
      input.plateState ||
      input.plateCity ||
      input.plateLocationMode ||
      input.mileage ||
      input.tyreSizeFront ||
      input.tyreSizeBack ||
      input.registrationExpiry ||
      input.registrationCardFileId ||
      input.vinPhotoFileId
  );
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function nullIfEmpty<T extends string | null | undefined>(value: T): string | null {
  const v = typeof value === "string" ? value.trim() : value;
  return v ? String(v) : null;
}

function normalizePhoneDigits(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits || null;
}
