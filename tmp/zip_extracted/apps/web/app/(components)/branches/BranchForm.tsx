"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ReferenceData } from "@repo/ai-core/client";
import { CountrySelect } from "@repo/ui/components/common/CountrySelect";
import { CitySelect } from "@repo/ui/components/common/CitySelect";
import { StateSelect } from "@repo/ui/components/common/StateSelect";
import { PhoneInput, type PhoneValue } from "@repo/ui/components/common/PhoneInput";
import { AttachmentField } from "@repo/ui/components/common/AttachmentField";
import { BankAccountFields } from "@/app/(components)/vendors/BankAccountFields";
import { useTheme } from "@repo/ui";

export type BranchFormValues = {
  name: string;
  display_name?: string | null;
  legal_name?: string | null;
  ownership_type?: "own" | "third_party" | null;
  branch_types?: string[];
  service_types?: string[];
  phone_code?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  google_location?: string | null;
  trade_license_number?: string | null;
  trade_license_issue?: string | null;
  trade_license_expiry?: string | null;
  trade_license_file_id?: string | null;
  allow_branch_invoicing?: boolean;
  vat_certificate_file_id?: string | null;
  trn_number?: string | null;
  contacts?: Array<{
    name: string;
    phone_code?: string | null;
    phone_number?: string | null;
    email?: string | null;
  }>;
  bankAccounts?: any[];
  is_active?: boolean;
};

type BranchFormProps = {
  companyId: string;
  initialValues?: BranchFormValues;
  onSubmit: (values: BranchFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  googleMapsApiKey?: string | null;
};

export function BranchForm({
  companyId,
  initialValues,
  onSubmit,
  onDelete,
  googleMapsApiKey,
}: BranchFormProps) {
  const { theme } = useTheme();
  const inputClass = theme.input;
  const inputBorderClass = theme.inputBorder;
  const labelClass = "block text-sm font-medium";
  const cardClass = `${theme.cardBg} ${theme.cardBorder}`;
  const router = useRouter();
  const countries = useMemo(() => ReferenceData.ReferenceCountries.allCountries, []);
  const buildValues = (incoming?: BranchFormValues): BranchFormValues => {
    const base: BranchFormValues = {
      name: "",
      display_name: "",
      legal_name: "",
      ownership_type: "own",
      branch_types: [],
      service_types: [],
      phone_code: "",
      phone: "",
      phoneNumber: "",
      email: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state_region: "",
      postal_code: "",
      country: "",
      google_location: "",
      trade_license_number: "",
      trade_license_issue: "",
      trade_license_expiry: "",
      trade_license_file_id: "",
      allow_branch_invoicing: false,
      vat_certificate_file_id: "",
      trn_number: "",
      contacts: [],
      bankAccounts: [],
      is_active: true,
      ...(incoming ?? {}),
    };

    const serviceMap: string[] = [];
    const allOptions = [
      { id: "RSA_Jumpstart", label: "Jumpstart" },
      { id: "RSA_Battery", label: "Battery" },
      { id: "RSA_Tyre", label: "Tyre" },
      { id: "RSA_Fuel", label: "Fuel" },
      { id: "RSA_Repair", label: "Repair" },
      { id: "Recovery_Regular", label: "Regular" },
      { id: "Recovery_Flatbed", label: "Flatbed" },
      { id: "Recovery_Covered", label: "Covered" },
      { id: "Workshop_Repair", label: "Repair" },
      { id: "Workshop_Tyre", label: "Tyre" },
      { id: "Workshop_BodyShop", label: "BodyShop" },
      { id: "Workshop_Service", label: "Service" },
    ];
    const incomingSet = new Set(base.service_types ?? []);
    allOptions.forEach((opt) => {
      if (incomingSet.has(opt.id) || incomingSet.has(opt.label)) {
        serviceMap.push(opt.id);
      }
    });
    base.service_types = serviceMap;
    return base;
  };

  const [values, setValues] = React.useState<BranchFormValues>(() => buildValues(initialValues));
  useEffect(() => {
    setValues(buildValues(initialValues));
  }, [initialValues]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.iso2 === (values.country ?? "")),
    [countries, values.country]
  );

  function splitPhone(value?: string | null): PhoneValue {
    if (!value) return { dialCode: "", nationalNumber: "" };
    const parts = value.trim().split(/\s+/);
    const dialCode = parts.shift() ?? "";
    return { dialCode, nationalNumber: parts.join(" ") };
  }

  function combinePhone(val: PhoneValue) {
    const dial = val.dialCode?.trim() ?? "";
    const num = val.nationalNumber?.trim() ?? "";
    if (!dial && !num) return "";
    return [dial, num].filter(Boolean).join(" ");
  }

  function extractEmbedSrc(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes("<iframe")) {
      const match = trimmed.match(/src=["']([^"']+)["']/i);
      return match?.[1] ?? null;
    }
    return trimmed;
  }

  function buildEmbedUrl(opts: { placeId?: string; center?: string }) {
    if (!googleMapsApiKey) return null;
    if (opts.placeId) {
      return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
        googleMapsApiKey
      )}&q=place_id:${encodeURIComponent(opts.placeId)}`;
    }
    if (opts.center) {
      return `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(
        googleMapsApiKey
      )}&center=${encodeURIComponent(opts.center)}&zoom=16`;
    }
    return null;
  }

  function toIframeHtml(embedUrl?: string | null) {
    if (!embedUrl) return null;
    return `<iframe title="Branch location map" src="${embedUrl}" width="100%" height="280" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  }

  function getPlaceId(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed.startsWith("place_id:")) {
      const id = trimmed.replace("place_id:", "").trim();
      return id || null;
    }
    const src = extractEmbedSrc(trimmed);
    if (!src) return null;
    try {
      const url = new URL(src);
      const q = url.searchParams.get("q");
      if (q && q.startsWith("place_id:")) {
        const id = q.replace("place_id:", "").trim();
        return id || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  function parseLatLng(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("latlng:")) {
      const coords = trimmed.replace("latlng:", "").trim();
      const [lat, lng] = coords.split(",").map((v) => Number(v));
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(trimmed)) {
      const [lat, lng] = trimmed.split(",").map((v) => Number(v));
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const src = extractEmbedSrc(trimmed) ?? trimmed;
    if (src.startsWith("http")) {
      try {
        const url = new URL(src);
        const q = url.searchParams.get("q");
        if (q && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(q)) {
          const [lat, lng] = q.split(",").map((v) => Number(v));
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
        }
        const center = url.searchParams.get("center");
        if (center && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(center)) {
          const [lat, lng] = center.split(",").map((v) => Number(v));
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  const [mapsReady, setMapsReady] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const mapMarkerRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!googleMapsApiKey || typeof window === "undefined") return;
    const existing = document.querySelector("script[data-google-maps='places']");
    if (existing) {
      if ((window as any).google?.maps?.places) setMapsReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      googleMapsApiKey
    )}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "places");
    script.onload = () => setMapsReady(true);
    script.onerror = () => setMapsReady(false);
    document.head.appendChild(script);
  }, [googleMapsApiKey]);

  React.useEffect(() => {
    if (!mapsReady || !googleMapsApiKey || !searchRef.current) return;
    const google = (window as any).google;
    if (!google?.maps?.places) return;
    const autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
      fields: ["place_id", "name", "formatted_address"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const placeId = place?.place_id;
      if (!placeId) return;
      const embedUrl = buildEmbedUrl({ placeId });
      const iframe = toIframeHtml(embedUrl);
      if (!iframe) return;
      setValues((prev) => ({ ...prev, google_location: iframe }));
    });
    return () => {
      if (listener?.remove) listener.remove();
    };
  }, [mapsReady, googleMapsApiKey]);

  React.useEffect(() => {
    if (!mapsReady || !googleMapsApiKey || !mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current.addListener("click", (e: any) => {
        if (!e?.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        const embedUrl = buildEmbedUrl({ center: coords });
        const iframe = toIframeHtml(embedUrl);
        if (!iframe) return;
        setValues((prev) => ({ ...prev, google_location: iframe }));
      });
    }
  }, [mapsReady, googleMapsApiKey]);

  React.useEffect(() => {
    if (!mapsReady || !googleMapsApiKey) return;
    if (values.google_location) return;
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        const embedUrl = buildEmbedUrl({ center: coords });
        const iframe = toIframeHtml(embedUrl);
        if (!iframe) return;
        setValues((prev) => (prev.google_location ? prev : { ...prev, google_location: iframe }));
      },
      () => {
        // Ignore geolocation errors; user can search or click on the map.
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [mapsReady, googleMapsApiKey, values.google_location]);

  React.useEffect(() => {
    if (!mapsReady || !googleMapsApiKey || !mapInstanceRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;
    const placeId = getPlaceId(values.google_location);
    const latLng = parseLatLng(values.google_location);

    const setMarker = (position: { lat: number; lng: number }) => {
      if (!mapMarkerRef.current) {
        mapMarkerRef.current = new google.maps.Marker({
          map: mapInstanceRef.current,
          position,
        });
      } else {
        mapMarkerRef.current.setPosition(position);
      }
      mapInstanceRef.current.setCenter(position);
      mapInstanceRef.current.setZoom(14);
    };

    if (latLng) {
      setMarker(latLng);
      return;
    }
    if (placeId) {
      const service = new google.maps.places.PlacesService(mapInstanceRef.current);
      service.getDetails({ placeId, fields: ["geometry"] }, (place: any, status: any) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK) return;
        const loc = place?.geometry?.location;
        if (!loc) return;
        setMarker({ lat: loc.lat(), lng: loc.lng() });
      });
    }
  }, [mapsReady, googleMapsApiKey, values.google_location]);

  useEffect(() => {
    if (!selectedCountry?.dialCode) return;
    const current = splitPhone(values.phone);
    if (!current.dialCode) {
      setValues((prev) => ({
        ...prev,
        phone: combinePhone({ dialCode: selectedCountry.dialCode, nationalNumber: current.nationalNumber }),
        phone_code: selectedCountry.dialCode,
      }));
    }
  }, [selectedCountry?.dialCode]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "display_name") {
      setValues((prev) => ({ ...prev, display_name: value, name: value }));
      return;
    }
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: BranchFormValues = {
        ...values,
        name: values.name || values.display_name || "",
        phone: values.phone || combinePhone(splitPhone(values.phone)),
        phone_code: values.phone_code,
        contacts: (values.contacts ?? []).slice(0, 3),
        bankAccounts: values.bankAccounts ?? [],
      };
      await onSubmit(payload);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to save branch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 rounded-xl p-6 shadow ${cardClass}`}>
      <div className={`rounded-lg p-4 ${cardClass}`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Branch details</h3>
          <p className="text-xs text-muted-foreground">Core identity and classification.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name field intentionally removed; internal name syncs with display_name */}
        <div className="md:col-span-2">
          <label className={`${labelClass} mb-1`}>
            Display Name <span className="text-red-400">*</span>
          </label>
          <input
            name="display_name"
            required
            value={values.display_name ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className={`${labelClass} mb-1`}>
            Legal Name <span className="text-red-400">*</span>
          </label>
          <input
            name="legal_name"
            required
            value={values.legal_name ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <span className={labelClass}>Ownership</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[
              { id: "own", label: "Own", desc: "Company owned branch" },
              { id: "third_party", label: "3rd Party", desc: "Partner operated branch" },
            ].map((opt) => {
              const active = values.ownership_type === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition ${inputBorderClass} ${
                    active ? "bg-primary/10 shadow-sm" : "bg-card hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="ownership_type"
                    checked={active}
                    onChange={() => setValues((prev) => ({ ...prev, ownership_type: opt.id as "own" | "third_party" }))}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{opt.label}</span>
                      {active && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Selected
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{opt.desc}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <label className={`${labelClass} mb-1`}>Branch Types</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            {[
              { id: "RSA", label: "RSA", desc: "Roadside assistance coverage" },
              { id: "Recovery", label: "Recovery", desc: "Towing and recovery ops" },
              { id: "Workshop", label: "Workshop", desc: "Repair and service bay" },
            ].map((type) => {
              const active = values.branch_types?.includes(type.id) ?? false;
              return (
                <label
                  key={type.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-left transition ${inputBorderClass} ${
                    active
                      ? "bg-primary/10 shadow-sm"
                      : "bg-card hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) =>
                      setValues((prev) => {
                        const set = new Set(prev.branch_types ?? []);
                        if (e.target.checked) set.add(type.id);
                        else set.delete(type.id);
                        return { ...prev, branch_types: Array.from(set) };
                      })
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{type.label}</span>
                      {active && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Selected
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{type.desc}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={`${labelClass} mb-1`}>Service Types</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {values.branch_types?.includes("RSA") && (
              <div className={`rounded-lg bg-card p-3 ${inputBorderClass}`}>
                <div className="text-xs font-semibold text-foreground">RSA</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "RSA_Jumpstart", label: "Jumpstart" },
                    { id: "RSA_Battery", label: "Battery" },
                    { id: "RSA_Tyre", label: "Tyre" },
                    { id: "RSA_Fuel", label: "Fuel" },
                    { id: "RSA_Repair", label: "Repair" },
                  ].map((svc) => {
                    const checked = values.service_types?.includes(svc.id) ?? false;
                    return (
                      <label
                        key={svc.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition ${inputBorderClass} ${
                          checked
                            ? "bg-primary/15 ring-1 ring-primary/40"
                            : "bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setValues((prev) => {
                              const set = new Set(prev.service_types ?? []);
                              if (e.target.checked) set.add(svc.id);
                              else set.delete(svc.id);
                              return { ...prev, service_types: Array.from(set) };
                            })
                          }
                          className="h-4 w-4"
                        />
                        <span className="font-medium">{svc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {values.branch_types?.includes("Recovery") && (
              <div className={`rounded-lg bg-card p-3 ${inputBorderClass}`}>
                <div className="text-xs font-semibold text-foreground">Recovery</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "Recovery_Regular", label: "Regular" },
                    { id: "Recovery_Flatbed", label: "Flatbed" },
                    { id: "Recovery_Covered", label: "Covered" },
                  ].map((svc) => {
                    const checked = values.service_types?.includes(svc.id) ?? false;
                    return (
                      <label
                        key={svc.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition ${inputBorderClass} ${
                          checked
                            ? "bg-primary/15 ring-1 ring-primary/40"
                            : "bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setValues((prev) => {
                              const set = new Set(prev.service_types ?? []);
                              if (e.target.checked) set.add(svc.id);
                              else set.delete(svc.id);
                              return { ...prev, service_types: Array.from(set) };
                            })
                          }
                          className="h-4 w-4"
                        />
                        <span className="font-medium">{svc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {values.branch_types?.includes("Workshop") && (
              <div className={`rounded-lg bg-card p-3 ${inputBorderClass}`}>
                <div className="text-xs font-semibold text-foreground">Workshop</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "Workshop_Repair", label: "Repair" },
                    { id: "Workshop_Tyre", label: "Tyre" },
                    { id: "Workshop_BodyShop", label: "BodyShop" },
                    { id: "Workshop_Service", label: "Service" },
                  ].map((svc) => {
                    const checked = values.service_types?.includes(svc.id) ?? false;
                    return (
                      <label
                        key={svc.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition ${inputBorderClass} ${
                          checked
                            ? "bg-primary/15 ring-1 ring-primary/40"
                            : "bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setValues((prev) => {
                              const set = new Set(prev.service_types ?? []);
                              if (e.target.checked) set.add(svc.id);
                              else set.delete(svc.id);
                              return { ...prev, service_types: Array.from(set) };
                            })
                          }
                          className="h-4 w-4"
                        />
                        <span className="font-medium">{svc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Phone</label>
          <PhoneInput
            countryIso2={values.country || undefined}
            value={splitPhone(values.phone)}
            onChange={(val) =>
              setValues((prev) => ({
                ...prev,
                phone: combinePhone(val),
                phone_code: val.dialCode,
                phoneNumber: val.nationalNumber,
              }))
            }
            label={undefined}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Email</label>
          <input
            name="email"
            type="email"
            value={values.email ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        </div>
      </div>

      <div className={`rounded-lg p-4 ${cardClass}`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Location</h3>
          <p className="text-xs text-muted-foreground">Where this branch operates.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-foreground mb-1">City</label>
          <CitySelect
            countryIso2={values.country || undefined}
            value={values.city || undefined}
            onChange={(city) => setValues((prev) => ({ ...prev, city: city ?? "" }))}
            label=""
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Country</label>
          <CountrySelect
            value={values.country || undefined}
            onChange={(country) =>
              setValues((prev) => ({
                ...prev,
                country: country ?? "",
                state_region: "",
                city: "",
              }))
            }
            label=""
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">State / Region</label>
          <StateSelect
            countryIso2={values.country || undefined}
            value={values.state_region || undefined}
            onChange={(state) => setValues((prev) => ({ ...prev, state_region: state ?? "" }))}
            label=""
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Postal Code</label>
          <input
            name="postal_code"
            value={values.postal_code ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-foreground mb-1">Address line 1</label>
          <input
            name="address_line1"
            value={values.address_line1 ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-foreground mb-1">Address line 2</label>
          <input
            name="address_line2"
            value={values.address_line2 ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-foreground mb-1">Google embedded location</label>
          <input
            ref={searchRef}
            placeholder={
              googleMapsApiKey
                ? "Search location in Google Maps"
                : "Set Google Maps API key in Company Settings to search"
            }
            className={inputClass}
            disabled={!googleMapsApiKey}
          />
          {googleMapsApiKey && (
            <div className="mt-3 overflow-hidden rounded-lg border border-border/40">
              <div ref={mapRef} className="h-64 w-full" />
            </div>
          )}
          <input
            name="google_location"
            placeholder="https://maps.google.com/..."
            value={values.google_location ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        </div>
      </div>

      <div className={`rounded-lg p-4 ${cardClass}`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Compliance</h3>
          <p className="text-xs text-muted-foreground">Licensing and attachments.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license number</label>
          <input
            name="trade_license_number"
            value={values.trade_license_number ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license attachment</label>
          <AttachmentField
            label=""
            value={values.trade_license_file_id ?? ""}
            onChange={(val) => setValues((prev) => ({ ...prev, trade_license_file_id: val }))}
            name="trade_license_file"
            uploadUrl="/api/files/upload"
            uploadFields={{ scope: "company", companyId }}
            onUploadComplete={(id) => setValues((prev) => ({ ...prev, trade_license_file_id: id }))}
            onUploadError={(msg) => setError(msg)}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license issue</label>
          <input
            type="date"
            name="trade_license_issue"
            value={values.trade_license_issue ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license expiry</label>
          <input
            type="date"
            name="trade_license_expiry"
            value={values.trade_license_expiry ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        </div>
      </div>

      <div className={`rounded-lg p-4 ${cardClass}`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Invoicing</h3>
          <p className="text-xs text-muted-foreground">Billing and tax settings.</p>
        </div>
        <div className="space-y-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-foreground">Allow branch invoicing</label>
          <input
            type="checkbox"
            checked={values.allow_branch_invoicing ?? false}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, allow_branch_invoicing: e.target.checked }))
            }
          />
        </div>
        {values.allow_branch_invoicing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-foreground mb-1">TRN number</label>
              <input
                name="trn_number"
                value={values.trn_number ?? ""}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">VAT certificate</label>
          <AttachmentField
            label=""
            value={values.vat_certificate_file_id ?? ""}
            onChange={(val) => setValues((prev) => ({ ...prev, vat_certificate_file_id: val }))}
            name="vat_certificate_file"
            uploadUrl="/api/files/upload"
            uploadFields={{ scope: "company", companyId }}
            onUploadComplete={(id) => setValues((prev) => ({ ...prev, vat_certificate_file_id: id }))}
            onUploadError={(msg) => setError(msg)}
          />
        </div>
          </div>
        )}
        </div>
      </div>

      <section className={`rounded-lg p-4 ${cardClass}`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Contacts</h3>
          <p className="text-xs text-muted-foreground">Primary branch contacts (max 3).</p>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Contacts list</h3>
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
            disabled={(values.contacts?.length ?? 0) >= 3}
            onClick={() =>
              setValues((prev) => ({
                ...prev,
                contacts: [...(prev.contacts ?? []), { name: "", phone_code: "", phone_number: "", email: "" }],
              }))
            }
          >
            Add contact
          </button>
        </div>
        {(values.contacts?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        )}
        <div className="space-y-4">
          {(values.contacts ?? []).map((c, idx) => (
            <div key={idx} className={`grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg p-3 ${cardClass}`}>
              <div>
                <label className="block text-sm text-foreground mb-1">Name</label>
                <input
                  className={inputClass}
                  value={c.name}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      next[idx] = { ...next[idx], name: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Phone</label>
                <PhoneInput
                  countryIso2={values.country || undefined}
                  value={{
                    dialCode: c.phone_code ?? values.phone_code ?? "",
                    nationalNumber: c.phone_number ?? "",
                  }}
                  onChange={(val) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      next[idx] = { ...next[idx], phone_code: val.dialCode, phone_number: val.nationalNumber };
                      return { ...prev, contacts: next };
                    })
                  }
                  label={undefined}
                />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Email</label>
                <input
                  className={inputClass}
                  value={c.email ?? ""}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      next[idx] = { ...next[idx], email: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      contacts: (prev.contacts ?? []).filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={`rounded-lg p-4 ${cardClass}`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Bank accounts</h3>
          <p className="text-xs text-muted-foreground">Payout details for this branch.</p>
        </div>
        <BankAccountFields
          accounts={values.bankAccounts ?? []}
          onChange={(accounts) => setValues((prev) => ({ ...prev, bankAccounts: accounts }))}
        />
      </div>

      <div className={`rounded-lg p-4 ${cardClass}`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Status</h3>
          <p className="text-xs text-muted-foreground">Enable or disable this branch.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={values.is_active ?? true}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, is_active: e.target.checked }))
              }
            />
            Active
          </label>
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-md border border-white/30 bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/company/${companyId}/branches`)}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg"
        >
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Delete this branch?")) return;
              setLoading(true);
              setError(null);
              try {
                await onDelete();
                router.push(`/company/${companyId}/branches`);
              } catch (err: any) {
                console.error(err);
                setError(err?.message ?? "Failed to delete branch");
              } finally {
                setLoading(false);
              }
            }}
            className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md transition hover:bg-red-700 hover:shadow-lg disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
