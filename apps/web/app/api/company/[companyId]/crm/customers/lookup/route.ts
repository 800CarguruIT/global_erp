import { NextRequest, NextResponse } from "next/server";
import { Crm } from "@repo/ai-core";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

function normalizePhone(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, "");
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { companyId } = await Promise.resolve(params);
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone"));
    const plate = url.searchParams.get("plate")?.trim() || "";

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    if (!phone && !plate) {
      return NextResponse.json({}, { status: 200 });
    }

    // Use the existing listCustomers search to find by phone or code/name/etc.
    const matches = await Crm.listCustomers(companyId, { search: phone || plate });
    const customer = matches[0];

    if (!customer) {
      return NextResponse.json({}, { status: 200 });
    }

    const customerWithCars = await Crm.getCustomerWithCars(customer.id);
    const cars =
      customerWithCars?.cars?.map(({ car }) => {
        const rawPlate = (car.plate_number ?? "").trim();
        let plateCode = (car as any).plate_code ?? "";
        let plateNumber = car.plate_number ?? "";
        if (!plateCode && rawPlate) {
          const match = rawPlate.match(/^([A-Za-z0-9]+)\\s+(.+)$/);
          if (match) {
            plateCode = match[1];
            plateNumber = match[2];
          } else {
            plateNumber = rawPlate;
          }
        } else if (plateCode && rawPlate.startsWith(`${plateCode} `)) {
          plateNumber = rawPlate.slice(plateCode.length).trim();
        }

        return {
          id: car.id,
          make: car.make,
          model: car.model,
          year: car.model_year,
          plateCountry: (car as any).plate_country ?? null,
          plateCode: plateCode || null,
          plateNumber: plateNumber || null,
          plateState: (car as any).plate_state ?? null,
          plateCity: (car as any).plate_city ?? null,
          plateLocationMode: (car as any).plate_location_mode ?? null,
          vin: car.vin ?? null,
          vinPhotoFileId: (car as any).vin_photo_file_id ?? null,
          tyreSizeFront: car.tyre_size_front ?? null,
          tyreSizeBack: car.tyre_size_back ?? null,
          registrationExpiry: car.registration_expiry ?? null,
          registrationCardFileId: car.registration_card_file_id ?? null,
          mileage: car.mileage ?? null,
        };
      }) ?? [];

    // Attempt to split phone into code and number (simple heuristic)
    const phoneCode = customer.phone?.startsWith("+")
      ? customer.phone.slice(0, 4).replace(/[^+\d]/g, "")
      : "";
    const phoneNumber = customer.phone
      ? customer.phone.replace(phoneCode, "").replace(/[^0-9]/g, "")
      : "";

    return NextResponse.json({
      customerId: customer.id ?? null,
      customerName: customer.name ?? "",
      phoneCode: phoneCode || null,
      phoneNumber: phoneNumber || null,
      email: customer.email ?? null,
      whatsappPhoneCode: customer.whatsapp_phone ?? null,
      whatsappPhoneNumber: null,
      cars,
    });
  } catch (err: any) {
    console.error("GET /api/company/[companyId]/crm/customers/lookup error", err);
    return NextResponse.json({ error: "Lookup failed", detail: err?.message ?? String(err) }, { status: 500 });
  }
}
