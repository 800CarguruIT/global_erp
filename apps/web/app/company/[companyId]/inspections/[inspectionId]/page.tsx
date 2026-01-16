"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, FileUploader, useTheme } from "@repo/ui";
import { toast } from "sonner";

type Params =
  | { params: { companyId: string; inspectionId: string } }
  | { params: Promise<{ companyId: string; inspectionId: string }> };

type InspectionData = {
  inspection: any;
  items: any[];
};

type CheckValue = "good" | "avg" | "bad" | "";

const checkItems = [
  { key: "engine", label: "Engine" },
  { key: "steering", label: "Steering" },
  { key: "tyres", label: "Tyres" },
  { key: "ac", label: "A/C Cooling" },
  { key: "body", label: "Car Body" },
  { key: "gear", label: "Gear" },
  { key: "suspension", label: "Suspension" },
  { key: "brakes", label: "Brakes" },
  { key: "battery", label: "Battery" },
  { key: "infotainment", label: "Infotainment" },
];

export default function InspectionDetailPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [car, setCar] = useState<any | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [carInVideoId, setCarInVideoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    advisorName: "",
    inspectorName: "",
    carInMileage: "",
    customerComplain: "",
    inspectorRemarks: "",
  });
  const [products, setProducts] = useState<Array<{ id: number; name: string; cost: number; type: string }>>([]);
  const [productResults, setProductResults] = useState<Array<{ id: number; name: string; cost: number; type: string }>>([]);
  const [productOpenIndex, setProductOpenIndex] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<string, CheckValue>>({});
  const [lineItemErrors, setLineItemErrors] = useState<Record<number, { part?: string; qty?: string; media?: string }>>(
    {}
  );
  const [parts, setParts] = useState<
    Array<{
      id?: string;
      productId?: number | null;
      productType?: string | null;
      part: string;
      description: string;
      qty: string;
      reason: string;
      partOrdered?: number | null;
      orderStatus?: string | null;

      mediaFileId?: string | null;
      isSaving?: boolean;
      isSaved?: boolean;
    }>
  >([{ part: "", description: "", qty: "1", reason: "Mandatory" }]);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setInspectionId(p?.inspectionId ?? null);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId || !inspectionId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/inspections/${inspectionId}`
        );
        if (!res.ok) throw new Error("Failed to load inspection");
        const data: { data: InspectionData } = await res.json();
        const payload = data?.data?.inspection ?? null;
        setInspection(payload);
        setLeadId(payload?.leadId ?? null);
        const draft = payload?.draftPayload ?? {};
        setForm((prev) => ({
          advisorName: draft.advisorName ?? prev.advisorName,
          inspectorName: draft.inspectorName ?? prev.inspectorName,
          carInMileage: draft.carInMileage ?? prev.carInMileage,
          customerComplain: draft.customerComplain ?? prev.customerComplain,
          inspectorRemarks: draft.inspectorRemarks ?? prev.inspectorRemarks,
        }));
        setChecks(draft.checks ?? {});
        if (payload?.customerId) {
          const custRes = await fetch(
            `/api/customers/${payload.customerId}?companyId=${companyId}`
          );
          if (custRes.ok) {
            const cust = await custRes.json();
            setCustomer(cust);
          }
        }
        if (payload?.carId) {
          const carRes = await fetch(
            `/api/cars/${payload.carId}?companyId=${companyId}`
          );
          if (carRes.ok) {
            const carData = await carRes.json();
            setCar(carData);
          }
        }
        if (payload?.leadId) {
          const leadRes = await fetch(
            `/api/company/${companyId}/sales/leads/${payload.leadId}`
          );
          if (leadRes.ok) {
            const leadJson = await leadRes.json().catch(() => ({}));
            const lead = leadJson?.data?.lead ?? leadJson?.data?.data ?? leadJson?.data ?? {};
            setCarInVideoId(lead?.carInVideo ?? lead?.carin_video ?? "");
            setForm((prev) => ({
              ...prev,
              advisorName: lead?.branchName ?? lead?.branch_name ?? prev.advisorName,
              customerComplain: lead?.customerRemark ?? prev.customerComplain,
            }));
          }
        }
        if (payload?.id && companyId) {
          const itemsRes = await fetch(
            `/api/company/${companyId}/workshop/inspections/${payload.id}/line-items?source=inspection`
          );
          if (itemsRes.ok) {
            const itemsJson = await itemsRes.json();
            const items = itemsJson?.data ?? [];
            if (items.length) {
              setParts(
                items.map((item: any) => ({
                  id: item.id,
                  productId: item.productId ?? item.product_id ?? null,
                  productType: item.productType ?? item.product_type ?? item.type ?? null,
                  part: item.productName ?? item.product_name ?? "",
                  description: item.description ?? "",
                  qty: String(item.quantity ?? 1),
                  reason: item.reason ?? "Mandatory",
                  mediaFileId: item.mediaFileId ?? item.media_file_id ?? null,
                  partOrdered: item.partOrdered ?? item.part_ordered ?? 0,
                  orderStatus: item.orderStatus ?? item.order_status ?? null,
                  isSaved: true,
                }))
              );
            }
          }
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load inspection");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, inspectionId]);

  useEffect(() => {
    if (!companyId) return;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const name = data?.user?.fullName ?? data?.user?.email ?? "";
        if (!name) return;
        setForm((prev) => ({
          ...prev,
          inspectorName: prev.inspectorName || name,
        }));
      })
      .catch(() => {
        // ignore
      });
  }, [companyId]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProducts(data?.data ?? []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (productOpenIndex === null) {
      setProductResults([]);
      return;
    }
    const query = parts[productOpenIndex]?.part?.trim() ?? "";
    let active = true;
    const timer = setTimeout(() => {
      const url = query ? `/api/products?search=${encodeURIComponent(query)}` : "/api/products";
      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (!active) return;
          setProductResults(data?.data ?? []);
        })
        .catch(() => {
          if (!active) return;
          setProductResults([]);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productOpenIndex, parts]);

  const plateLabel = useMemo(() => {
    return car?.plate_number || car?.plateNumber || "Plate";
  }, [car]);
  const startedAt = inspection?.startAt ?? inspection?.start_at ?? null;
  const completedAt = inspection?.completeAt ?? inspection?.complete_at ?? null;

  const updateCheck = (key: string, value: CheckValue) => {
    setChecks((prev) => ({ ...prev, [key]: value }));
  };


  const updatePart = (
    index: number,
    field: "part" | "description" | "qty" | "reason",
    value: string,
    extra?: { productId?: number | null; mediaFileId?: string | null; productType?: string | null }
  ) => {
    setParts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current?.partOrdered === 1 || current?.orderStatus === "Ordered" || current?.orderStatus === "Received") {
        return prev;
      }
      next[index] = {
        ...next[index],
        [field]: value,
        productId: extra?.productId ?? next[index].productId,
        productType: extra?.productType ?? next[index].productType,
        mediaFileId: extra?.mediaFileId ?? next[index].mediaFileId,
        isSaved: false,
      };
      return next;
    });
    if (field === "part" || field === "qty") {
      setLineItemErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: undefined },
      }));
    }
  };

  const updatePartMedia = (index: number, mediaFileId: string | null) => {
    setParts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current?.partOrdered === 1 || current?.orderStatus === "Ordered" || current?.orderStatus === "Received") {
        return prev;
      }
      next[index] = { ...next[index], mediaFileId, isSaved: false };
      return next;
    });
    setLineItemErrors((prev) => ({
      ...prev,
      [index]: { ...prev[index], media: undefined },
    }));
  };

  const serializeParts = () =>
    parts.map((p) => ({
      id: p.id,
      productId: p.productId ?? null,
      productType: p.productType ?? null,
      part: p.part,
      description: p.description,
      qty: p.qty,
      reason: p.reason,

      mediaFileId: p.mediaFileId ?? null,
    }));

  const normalizeProductType = (value?: string | null) =>
    (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  const resolveProductType = (row: (typeof parts)[number]) => {
    if (row.productType) return row.productType;
    const match = products.find((product) => product.id === row.productId);
    return match?.type ?? "";
  };

  const getMediaRequirement = (row: (typeof parts)[number]) => {
    const type = normalizeProductType(resolveProductType(row));
    const isSparePart = type.includes("spare") && type.includes("part");
    const isTyre = type.includes("tyre") || type.includes("tire");
    if (isSparePart) {
      return { required: true, kind: "image" as const, label: "Image" };
    }
    if (isTyre) {
      return { required: true, kind: "video" as const, label: "Video" };
    }
    return { required: false, kind: "image" as const, label: "Media" };
  };

  const saveLineItem = async (index: number) => {
    if (!companyId || !inspectionId) return;
    const row = parts[index];
    if (row?.partOrdered === 1 || row?.orderStatus === "Ordered" || row?.orderStatus === "Received") {
      toast.error("Ordered/received items cannot be edited.");
      return;
    }
    setError(null);
    const nextErrors: { part?: string; qty?: string; media?: string } = {};
    if (!row.part.trim()) {
      nextErrors.part = "Part is required.";
    }
    const qtyNumber = Number(row.qty);
    if (!Number.isFinite(qtyNumber) || qtyNumber < 1) {
      nextErrors.qty = "Quantity must be a number and at least 1.";
    }
    const mediaRequirement = getMediaRequirement(row);
    if (mediaRequirement.required && !row.mediaFileId) {
      nextErrors.media = `${mediaRequirement.label} upload is required.`;
    }
    if (nextErrors.part || nextErrors.qty || nextErrors.media) {
      setLineItemErrors((prev) => ({ ...prev, [index]: nextErrors }));
      return;
    }
    setParts((prev) => prev.map((p, i) => (i === index ? { ...p, isSaving: true } : p)));
    try {
      const payload = {
        leadId: leadId ?? null,
        productId: row.productId ?? null,
        productName: row.part,
        description: row.description,
        quantity: qtyNumber,
        reason: row.reason,

        mediaFileId: row.mediaFileId ?? null,
      };
      const res = await fetch(
        `/api/company/${companyId}/workshop/inspections/${inspectionId}/line-items` +
          (row.id ? `/${row.id}` : ""),
        {
          method: row.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed to save line item");
      const data = await res.json();
      const saved = data?.data ?? {};
      setParts((prev) =>
        prev.map((p, i) =>
          i === index
            ? {
                ...p,
                id: saved.id ?? p.id,
                isSaved: true,
                isSaving: false,

              }
            : p
        )
      );
      toast.success("Line item saved successfully.");
      setLineItemErrors((prev) => ({ ...prev, [index]: {} }));
    } catch (err) {
      setParts((prev) => prev.map((p, i) => (i === index ? { ...p, isSaving: false } : p)));
      setError("Failed to save line item");
    }
  };

  const deleteLineItem = async (index: number) => {
    const row = parts[index];
    if (row?.partOrdered === 1 || row?.orderStatus === "Ordered" || row?.orderStatus === "Received") {
      toast.error("Ordered/received items cannot be deleted.");
      return;
    }
    if (row.id && companyId && inspectionId) {
      await fetch(
        `/api/company/${companyId}/workshop/inspections/${inspectionId}/line-items/${row.id}`,
        { method: "DELETE" }
      ).catch(() => null);
    }
    setParts((prev) => prev.filter((_, i) => i !== index));
    toast.success("Line item deleted successfully.");
  };

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Inspection -</h1>
            <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${theme.cardBorder}`}>
              {plateLabel}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(startedAt || completedAt) && (
              <div className="hidden flex-col items-end text-[11px] text-muted-foreground sm:flex">
                {startedAt && <div>Started: {new Date(startedAt).toLocaleString()}</div>}
                {completedAt && <div>Completed: {new Date(completedAt).toLocaleString()}</div>}
              </div>
            )}
            <Link
              href={companyId ? `/company/${companyId}/inspections` : "#"}
              className="text-sm text-primary hover:underline"
            >
              Back to inspections
            </Link>
          </div>
        </div>
        {(startedAt || completedAt) && (
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground sm:hidden">
            {startedAt && <div>Started: {new Date(startedAt).toLocaleString()}</div>}
            {completedAt && <div>Completed: {new Date(completedAt).toLocaleString()}</div>}
          </div>
        )}

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className={`p-4 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="text-sm font-semibold">Inspection Details</div>
              {loading && <div className="text-xs text-white/60">Loading...</div>}
            </div>
            <div className="grid gap-4 pt-4 lg:grid-cols-2">
              {checkItems.map((item) => (
                <div key={item.key} className="grid items-center gap-3 text-sm md:grid-cols-[140px_auto]">
                  <div className="font-semibold text-blue-400">{item.label}</div>
                  <div className="flex items-center gap-2 text-xs">
                    {(["good", "avg", "bad"] as CheckValue[]).map((val) => {
                      const colorClass =
                        val === "good"
                          ? "text-emerald-400"
                          : val === "avg"
                          ? "text-amber-400"
                          : "text-rose-400";
                      return (
                        <label key={val} className={`flex items-center gap-1 ${colorClass}`}>
                          <input
                            type="radio"
                            name={`check-${item.key}`}
                            checked={checks[item.key] === val}
                            onChange={() => updateCheck(item.key, val)}
                          />
                          <span className="capitalize">{val}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-white/70">Lead Branch</label>
                <input
                  type="text"
                  className={theme.input}
                  value={form.advisorName}
                  readOnly
                  placeholder="SC_Department"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Inspector Name</label>
                <input
                  type="text"
                  className={theme.input}
                  value={form.inspectorName}
                  readOnly
                  placeholder="master_admin"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Car-In Mileage</label>
                <input
                  type="text"
                  className={theme.input}
                  value={form.carInMileage}
                  onChange={(e) => setForm((prev) => ({ ...prev, carInMileage: e.target.value }))}
                  placeholder="543367685"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-white/70">Customer Complain</label>
                <textarea
                  className={theme.input}
                  rows={4}
                  value={form.customerComplain}
                  readOnly
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Inspector Remarks</label>
                <textarea
                  className={theme.input}
                  rows={4}
                  value={form.inspectorRemarks}
                  onChange={(e) => setForm((prev) => ({ ...prev, inspectorRemarks: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold">Parts Needed</div>
              <div className={`mt-2 rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} p-3`}>
                <div className="grid w-full gap-3 lg:grid-cols-[2fr_2fr_1fr_1fr_1.5fr] text-xs font-semibold text-white/70">
                  <div>Parts Needed</div>
                  <div>Description</div>
                  <div>Quantity</div>
                  <div>Picture / Video</div>
                  <div>Actions</div>
                </div>
                <div className="mt-2 space-y-2">
                  {parts.map((row, index) => {
                    const isLocked =
                      row.partOrdered === 1 || row.orderStatus === "Ordered" || row.orderStatus === "Received";
                    return (
                      <div key={index} className="grid w-full items-start gap-3 lg:grid-cols-[2fr_2fr_1fr_1fr_1.5fr]">
                        <div className="space-y-1">
                          <div className="relative">
                            <input
                              type="text"
                              className={`${theme.input} h-10 w-full`}
                              value={row.part}
                              disabled={isLocked}
                              onChange={(e) => updatePart(index, "part", e.target.value)}
                              placeholder="Search products"
                              onFocus={() => setProductOpenIndex(index)}
                              onBlur={() => {
                                setTimeout(
                                  () => setProductOpenIndex((current) => (current === index ? null : current)),
                                  150
                                );
                              }}
                            />
                          {productOpenIndex === index && (
                            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-white/10 bg-slate-950 text-xs shadow-lg">
                              {(productResults.length ? productResults : products).map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-white/80 hover:bg-white/10"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    updatePart(index, "part", product.name, {
                                      productId: product.id,
                                      productType: product.type ?? null,
                                    });
                                    setProductOpenIndex(null);
                                  }}
                                >
                                  <span className="font-semibold">{product.name}</span>
                                  <span className="text-[10px] text-white/50">{product.type}</span>
                                </button>
                              ))}
                              {productResults.length === 0 && products.length === 0 && (
                                <div className="px-3 py-2 text-white/50">No products found.</div>
                              )}
                            </div>
                          )}
                        </div>
                        {lineItemErrors[index]?.part && (
                          <div className="text-xs text-destructive">{lineItemErrors[index]?.part}</div>
                        )}
                      </div>
                      <input
                        type="text"
                        className={`${theme.input} h-10 w-full`}
                        value={row.description}
                        disabled={isLocked}
                        onChange={(e) => updatePart(index, "description", e.target.value)}
                        placeholder="do it"
                      />
                      <div className="space-y-1">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className={`${theme.input} h-10 w-full`}
                          value={row.qty}
                          disabled={isLocked}
                          onChange={(e) => updatePart(index, "qty", e.target.value)}
                        />
                        {lineItemErrors[index]?.qty && (
                          <div className="text-xs text-destructive">{lineItemErrors[index]?.qty}</div>
                        )}
                      </div>
                      <div className="space-y-1">
                        {(() => {
                          const mediaRequirement = getMediaRequirement(row);
                          return (
                            <FileUploader
                              label=""
                              kind={mediaRequirement.kind}
                              value={row.mediaFileId ?? ""}
                              onChange={(id) => updatePartMedia(index, id ?? "")}
                              disabled={isLocked}
                              buttonOnly
                              showPreview
                              buttonClassName="h-10 w-full justify-center "
                              containerClassName="w-full"
                            />
                          );
                        })()}
                        {lineItemErrors[index]?.media && (
                          <div className="text-xs text-destructive">{lineItemErrors[index]?.media}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {row.isSaved ? (
                          <button
                            type="button"
                            className="rounded-md bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white"
                            disabled={isLocked}
                            onClick={() => {
                              setParts((prev) =>
                                prev.map((p, i) => (i === index ? { ...p, isSaved: false } : p))
                              );
                              toast.success("Line item is now in edit mode.");
                            }}
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white"
                            onClick={() => saveLineItem(index)}
                            disabled={row.isSaving || isLocked}
                          >
                            {row.isSaving ? "Saving..." : "Save"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-md bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white"
                          onClick={() => deleteLineItem(index)}
                          disabled={isLocked}
                        >
                          Delete
                        </button>
                        {!row.isSaved && (
                          <span className="text-[11px] text-amber-400">Please save this item</span>
                        )}
                        {isLocked && (
                          <span className="text-[11px] text-amber-400">Ordered/received item</span>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white"
                    onClick={() =>
                      setParts((prev) => [
                        ...prev,
                        { part: "", description: "", qty: "1", reason: "Mandatory" },
                      ])
                    }
                    disabled={parts.some((p) => !p.isSaved)}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              {!startedAt ? (
                <button
                  type="button"
                  className={`rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  disabled={saving || !companyId || !inspectionId}
                  onClick={async () => {
                    if (!companyId || !inspectionId) return;
                    setSaving(true);
                    try {
                      const res = await fetch(
                        `/api/company/${companyId}/workshop/inspections/${inspectionId}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: "pending",
                            startAt: new Date().toISOString(),
                            draftPayload: {
                              advisorName: form.advisorName,
                              inspectorName: form.inspectorName,
                              carInMileage: form.carInMileage,
                              customerComplain: form.customerComplain,
                              inspectorRemarks: form.inspectorRemarks,
                              checks,
                              parts: serializeParts(),
                            },
                          }),
                        }
                      );
                      if (!res.ok) throw new Error("Failed to start inspection");
                      if (leadId) {
                        const leadRes = await fetch(
                          `/api/company/${companyId}/crm/leads/${leadId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              carInVideo: carInVideoId || null,
                            }),
                          }
                        );
                        if (!leadRes.ok) throw new Error("Failed to save lead videos");
                      }
                      setInspection((prev: any) => ({
                        ...prev,
                        startAt: new Date().toISOString(),
                      }));
                    } catch (err) {
                      setError("Failed to start inspection");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving..." : "Start Inspection"}
                </button>
              ) : completedAt ? (
                <button
                  type="button"
                  className={`rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  disabled={saving || !companyId || !inspectionId}
                  onClick={async () => {
                    if (!companyId || !inspectionId) return;
                    setSaving(true);
                    try {
                      const res = await fetch(
                        `/api/company/${companyId}/workshop/inspections/${inspectionId}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            draftPayload: {
                              advisorName: form.advisorName,
                              inspectorName: form.inspectorName,
                              carInMileage: form.carInMileage,
                              customerComplain: form.customerComplain,
                              inspectorRemarks: form.inspectorRemarks,
                              checks,
                              parts: serializeParts(),
                            },
                          }),
                        }
                      );
                      if (!res.ok) throw new Error("Failed to update inspection");
                      if (leadId) {
                        const leadRes = await fetch(
                          `/api/company/${companyId}/crm/leads/${leadId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              carInVideo: carInVideoId || null,
                            }),
                          }
                        );
                        if (!leadRes.ok) throw new Error("Failed to save lead videos");
                      }
                    } catch (err) {
                      setError("Failed to update inspection");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving..." : "Update Inspection"}
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-md bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={saving || !companyId || !inspectionId}
                  onClick={async () => {
                    if (!companyId || !inspectionId) return;
                    setSaving(true);
                    try {
                      const res = await fetch(
                        `/api/company/${companyId}/workshop/inspections/${inspectionId}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: "completed",
                            completeAt: new Date().toISOString(),
                            draftPayload: {
                              advisorName: form.advisorName,
                              inspectorName: form.inspectorName,
                              carInMileage: form.carInMileage,
                              customerComplain: form.customerComplain,
                              inspectorRemarks: form.inspectorRemarks,
                              checks,
                              parts: serializeParts(),
                            },
                          }),
                        }
                      );
                      if (!res.ok) throw new Error("Failed to complete inspection");
                      if (leadId) {
                        const leadRes = await fetch(
                          `/api/company/${companyId}/crm/leads/${leadId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              carInVideo: carInVideoId || null,
                            }),
                          }
                        );
                        if (!leadRes.ok) throw new Error("Failed to save lead videos");
                      }
                      setInspection((prev: any) => ({
                        ...prev,
                        completeAt: new Date().toISOString(),
                      }));
                    } catch (err) {
                      setError("Failed to complete inspection");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving..." : "Complete Inspection"}
                </button>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className={`overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                Customer Details
              </div>
              <div className="p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-white/70">Customer ID</div>
                  <div className="font-semibold">{customer?.code ?? customer?.id ?? "N/A"}</div>
                  <div className="text-white/70">Customer Name</div>
                  <div className="font-semibold">{customer?.name ?? "N/A"}</div>
                  <div className="text-white/70">Customer Phone</div>
                  <div className="font-semibold">{customer?.phone ?? "N/A"}</div>
                  <div className="text-white/70">Customer Type</div>
                  <div className="font-semibold">{customer?.customer_type ?? "Regular"}</div>
                </div>
              </div>
            </Card>

            <Card className={`overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                Car Details
              </div>
              <div className="p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-white/70">Plate #</div>
                  <div className="font-semibold">{plateLabel}</div>
                  <div className="text-white/70">Car</div>
                  <div className="font-semibold">
                    {[car?.make, car?.model].filter(Boolean).join(" ") || "N/A"}
                  </div>
                  <div className="text-white/70">Type</div>
                  <div className="font-semibold">{car?.body_type ?? car?.bodyType ?? "Regular"}</div>
                  <div className="text-white/70">Free Battery</div>
                  <div className="font-semibold">Not Eligible</div>
                </div>
              </div>
            </Card>

            <Card className={`overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                Inspection Videos
              </div>
              <div className="p-3 text-xs">
                <div className="space-y-3">
                  <FileUploader
                    label="Car In Video"
                    kind="video"
                    value={carInVideoId}
                    onChange={(id) => setCarInVideoId(id ?? "")}
                  />
                  {carInVideoId && (
                    <div className="space-y-2">
                      <video
                        className="w-full rounded-md border border-white/10"
                        controls
                        preload="metadata"
                        src={`/api/files/${carInVideoId}`}
                      />
                      <a
                        href={`/api/files/${carInVideoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Open video
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className={`overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                Service History
              </div>
              <div className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="text-white/70">Show entries</div>
                  <input type="text" className={theme.input} placeholder="Search" />
                </div>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}




