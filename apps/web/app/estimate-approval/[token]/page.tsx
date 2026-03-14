"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Params = { params: { token: string } | Promise<{ token: string }> };

type ApprovalItem = {
  id: string;
  lineNo: number;
  partName: string;
  description: string;
  quantity: number;
  sale: number;
  status: string;
  approvedType?: "oe" | "oem" | "aftm" | "used" | null;
  selectedType?: "oe" | "oem" | "aftm" | "used" | null;
  typeSales?: Partial<Record<"oe" | "oem" | "aftm" | "used", number>>;
};

type ApprovalPayload = {
  estimate: {
    id: string;
    status: string;
    vatRate: number;
    customerName: string;
    customerPhone: string;
    carLabel: string;
    carPlate: string;
    createdAt: string;
  };
  approval: {
    status: string;
    approvedAt: string | null;
    expiresAt?: string | null;
    isExpired?: boolean;
    customerName: string | null;
    termsAccepted: boolean;
    selectedItemIds: string[];
    selectedTypeByItemId?: Record<string, "oe" | "oem" | "aftm" | "used">;
  };
  items: ApprovalItem[];
};

function money(value: number) {
  return Number(value || 0).toFixed(2);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function estimateLineHours(partName: string, description: string) {
  const text = `${partName} ${description}`.toLowerCase();
  let hours = 1.2; // default quick replacement
  if (/(compressor|ac compressor|gearbox|transmission|engine)/.test(text)) hours = 4.5;
  else if (/(radiator|condenser|alternator|starter|suspension|control arm|bearing|fuel pump)/.test(text)) hours = 2.5;
  else if (/(brake|disc|pad|rotor|sensor|air filter|spark plug|coil)/.test(text)) hours = 1.5;
  else if (/(tyre|tire|wheel|alignment|battery|wiper)/.test(text)) hours = 1.0;
  return hours;
}

function estimateDeliveryHoursByType(type: "oe" | "oem" | "aftm" | "used" | undefined) {
  if (type === "aftm") return 6; // usually faster availability
  if (type === "oem") return 18;
  if (type === "oe") return 30;
  if (type === "used") return 36; // sourcing time can be longer
  return 12;
}

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 19;

function addBusinessHours(start: Date, hoursToAdd: number) {
  if (hoursToAdd <= 0) return start;
  const cursor = new Date(start.getTime());
  let remaining = hoursToAdd;

  const alignToWorkingWindow = () => {
    const h = cursor.getHours() + cursor.getMinutes() / 60;
    if (h < WORK_START_HOUR) {
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
      return;
    }
    if (h >= WORK_END_HOUR) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
    }
  };

  alignToWorkingWindow();
  while (remaining > 0) {
    alignToWorkingWindow();
    const currentHour = cursor.getHours() + cursor.getMinutes() / 60;
    const availableToday = Math.max(0, WORK_END_HOUR - currentHour);
    if (availableToday <= 0) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }
    const consume = Math.min(remaining, availableToday);
    cursor.setTime(cursor.getTime() + consume * 60 * 60 * 1000);
    remaining -= consume;
  }
  return cursor;
}

export default function EstimateApprovalPage({ params }: Params) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApprovalPayload | null>(null);
  const [selectedTypeByItemId, setSelectedTypeByItemId] = useState<Record<string, "oe" | "oem" | "aftm" | "used">>({});
  const [customerName, setCustomerName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetch(`/api/public/estimate-approval/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(json?.error ?? "Failed to load estimate"));
        return json?.data as ApprovalPayload;
      })
      .then((data) => {
        if (!mounted) return;
        setPayload(data);
        const nextSelectedTypes: Record<string, "oe" | "oem" | "aftm" | "used"> = {};
        const savedMap = data?.approval?.selectedTypeByItemId ?? {};
        Object.entries(savedMap).forEach(([itemId, type]) => {
          if (type === "oe" || type === "oem" || type === "aftm" || type === "used") {
            nextSelectedTypes[itemId] = type;
          }
        });
        (data?.items ?? []).forEach((item) => {
          if (nextSelectedTypes[item.id]) return;
          if (
            item.selectedType === "oe" ||
            item.selectedType === "oem" ||
            item.selectedType === "aftm" ||
            item.selectedType === "used"
          ) {
            nextSelectedTypes[item.id] = item.selectedType;
          }
        });
        setSelectedTypeByItemId(nextSelectedTypes);
        setCustomerName(String(data?.approval?.customerName ?? data?.estimate?.customerName ?? ""));
        setTermsAccepted(Boolean(data?.approval?.termsAccepted));
        setSuccess(
          String(data?.approval?.status ?? "").toLowerCase() === "approved"
            ? `Already approved on ${formatDate(data?.approval?.approvedAt)}`
            : null
        );
        if (data?.approval?.isExpired) {
          setError("This estimate has expired. Please request a new estimate.");
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load estimate");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  const isAlreadyApproved = String(payload?.approval?.status ?? "").toLowerCase() === "approved";
  const isExpired = !!payload?.approval?.isExpired;
  const items = useMemo(() => payload?.items ?? [], [payload?.items]);
  const selectedItemIds = useMemo(() => {
    const validIds = new Set(items.map((item) => item.id));
    return Object.keys(selectedTypeByItemId).filter((id) => validIds.has(id));
  }, [items, selectedTypeByItemId]);
  const estimatedTotalHours = useMemo(() => {
    return items
      .filter((item) => selectedItemIds.includes(item.id))
      .reduce((sum, item) => sum + estimateLineHours(item.partName, item.description), 0);
  }, [items, selectedItemIds]);
  const estimatedDeliveryHours = useMemo(() => {
    return items
      .filter((item) => selectedItemIds.includes(item.id))
      .reduce((maxHours, item) => {
        const type = selectedTypeByItemId[item.id];
        const hours = estimateDeliveryHoursByType(type);
        return Math.max(maxHours, hours);
      }, 0);
  }, [items, selectedItemIds, selectedTypeByItemId]);
  const estimatedCompletionAt = useMemo(() => {
    const combinedHours = estimatedTotalHours + estimatedDeliveryHours;
    if (combinedHours <= 0) return null;
    const now = new Date();
    const completion = addBusinessHours(now, combinedHours);
    return completion;
  }, [estimatedTotalHours, estimatedDeliveryHours]);
  const getEffectiveItemSale = (item: ApprovalItem) => {
    const selectedType = selectedTypeByItemId[item.id];
    const typePrice = selectedType ? Number(item.typeSales?.[selectedType] ?? NaN) : NaN;
    if (Number.isFinite(typePrice) && typePrice > 0) return typePrice;
    return Number(item.sale || 0);
  };
  const subtotal = useMemo(() => {
    return items
      .filter((item) => selectedItemIds.includes(item.id))
      .reduce((sum, item) => {
        const selectedType = selectedTypeByItemId[item.id];
        const typePrice = selectedType ? Number(item.typeSales?.[selectedType] ?? NaN) : NaN;
        const lineSale = Number.isFinite(typePrice) && typePrice > 0 ? typePrice : Number(item.sale || 0);
        return sum + lineSale;
      }, 0);
  }, [items, selectedItemIds, selectedTypeByItemId]);
  const vatRate = Number(payload?.estimate?.vatRate ?? 0);
  const vat = (subtotal * vatRate) / 100;
  const grandTotal = subtotal + vat;

  async function submitApproval(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !payload) return;
    if (isExpired) {
      setError("This estimate has expired. Please request a new estimate.");
      return;
    }
    if (!termsAccepted) {
      setError("Please accept terms before approving.");
      return;
    }
    if (!signatureDataUrl) {
      setError("Please add your signature.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/public/estimate-approval/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedItemIds,
          selectedTypeByItemId,
          termsAccepted: true,
          signatureDataUrl,
          customerName: customerName || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to submit approval"));
      setSuccess("Estimate approved successfully.");
          setPayload((prev) =>
            prev
              ? {
                  ...prev,
                  approval: {
                ...prev.approval,
                status: "approved",
                approvedAt: json?.data?.approvedAt ?? new Date().toISOString(),
                termsAccepted: true,
                    selectedItemIds,
                    selectedTypeByItemId,
                    customerName: customerName || prev.approval.customerName,
                  },
                }
          : prev
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit approval");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h1 className="text-2xl font-semibold">Estimate Approval</h1>
          <p className="mt-1 text-sm text-slate-300">Please review and approve selected line items.</p>
        </div>

        {loading ? <div className="mt-4 text-sm text-slate-300">Loading...</div> : null}
        {error ? <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div> : null}

        {!loading && payload ? (
          <form onSubmit={submitApproval} className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <div><span className="text-slate-400">Estimate:</span> {payload.estimate.id}</div>
              <div><span className="text-slate-400">Created:</span> {formatDate(payload.estimate.createdAt)}</div>
              <div><span className="text-slate-400">Customer:</span> {payload.estimate.customerName || "-"}</div>
              <div><span className="text-slate-400">Phone:</span> {payload.estimate.customerPhone || "-"}</div>
              <div><span className="text-slate-400">Car:</span> {payload.estimate.carLabel || "-"}</div>
              <div><span className="text-slate-400">Plate:</span> {payload.estimate.carPlate || "-"}</div>
              <div><span className="text-slate-400">Expires:</span> {formatDate(payload.approval.expiresAt)}</div>
              <div><span className="text-slate-400">Approval Link:</span> {isExpired ? "Expired" : "Active"}</div>
            </div>

            {isExpired && !isAlreadyApproved ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                Estimate link expired. Please request a new estimate from workshop.
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-800/80 text-left text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Part</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Type Sale</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Selected Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-400" colSpan={6}>
                        No line items found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      return (
                        <tr key={item.id} className="border-t border-white/10">
                          <td className="px-3 py-2">{item.lineNo}</td>
                          <td className="px-3 py-2">{item.partName}</td>
                          <td className="px-3 py-2 text-slate-300">{item.description || "-"}</td>
                          <td className="px-3 py-2">
                            <div className="grid grid-cols-2 gap-1">
                              {(["oe", "oem", "aftm", "used"] as const).map((type) => {
                                const price = Number(item.typeSales?.[type] ?? NaN);
                                const hasPrice = Number.isFinite(price) && price > 0;
                                const active = selectedTypeByItemId[item.id] === type;
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    disabled={isAlreadyApproved || isExpired || !hasPrice}
                                    className={`rounded-md border px-2 py-1 text-[11px] ${
                                      active
                                        ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-100"
                                        : "border-white/15 bg-slate-950/40 text-slate-300"
                                    } disabled:opacity-40`}
                                    onClick={() =>
                                      setSelectedTypeByItemId((prev) => {
                                        if (prev[item.id] === type) {
                                          const next = { ...prev };
                                          delete next[item.id];
                                          return next;
                                        }
                                        return { ...prev, [item.id]: type };
                                      })
                                    }
                                  >
                                    <div className="uppercase">{type}</div>
                                    <div>{hasPrice ? `AED ${money(price)}` : "-"}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">{money(item.quantity)}</td>
                          <td className="px-3 py-2 text-right">AED {money(getEffectiveItemSale(item))}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm">
              <div className="mb-1 font-semibold">Summary</div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Subtotal</span><span>AED {money(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">VAT ({vatRate.toFixed(2)}%)</span><span>AED {money(vat)}</span></div>
              <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1 font-semibold"><span>Grand Total</span><span>AED {money(grandTotal)}</span></div>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-slate-400">Estimated Completion</span>
                <span>{estimatedCompletionAt ? estimatedCompletionAt.toLocaleString() : "-"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 p-4">
              <div className="mb-2 text-sm font-semibold">Customer Confirmation</div>
              <input
                type="text"
                className="mb-3 w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm outline-none"
                placeholder="Customer name"
                disabled={isAlreadyApproved || isExpired}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  disabled={isAlreadyApproved || isExpired}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                I approve selected estimate items and accept workshop terms and conditions.
              </label>
            </div>

            <SignaturePad disabled={isAlreadyApproved || isExpired} onChange={setSignatureDataUrl} />

            <button
              type="submit"
              disabled={submitting || isAlreadyApproved || isExpired}
              className="inline-flex rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isAlreadyApproved ? "Already Approved" : isExpired ? "Expired - Request New Estimate" : submitting ? "Submitting..." : "Approve Estimate"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}

function SignaturePad({ disabled, onChange }: { disabled?: boolean; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  function getCtx(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#e2e8f0";
    return ctx;
  }

  function getPos(canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in evt) {
      const touch = evt.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function startDraw(canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) {
    if (disabled) return;
    const ctx = getCtx(canvas);
    if (!ctx) return;
    const { x, y } = getPos(canvas, evt);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  }

  function moveDraw(canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) {
    if (!drawing || disabled) return;
    const ctx = getCtx(canvas);
    if (!ctx) return;
    const { x, y } = getPos(canvas, evt);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStroke) setHasStroke(true);
  }

  function endDraw(canvas: HTMLCanvasElement) {
    if (!drawing) return;
    setDrawing(false);
    if (!hasStroke) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange("");
  }

  return (
    <div className="rounded-xl border border-white/10 p-3">
      <div className="mb-2 text-sm font-semibold">Signature</div>
      <div className="overflow-hidden rounded-lg border border-white/15 bg-slate-950/60">
        <canvas
          ref={canvasRef}
          width={700}
          height={220}
          className="h-44 w-full touch-none"
          onMouseDown={(e) => startDraw(e.currentTarget, e)}
          onMouseMove={(e) => moveDraw(e.currentTarget, e)}
          onMouseUp={(e) => endDraw(e.currentTarget)}
          onMouseLeave={(e) => endDraw(e.currentTarget)}
          onTouchStart={(e) => startDraw(e.currentTarget, e)}
          onTouchMove={(e) => moveDraw(e.currentTarget, e)}
          onTouchEnd={(e) => endDraw(e.currentTarget)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs disabled:opacity-60"
          disabled={disabled}
          onClick={() => {
            if (!canvasRef.current) return;
            clear(canvasRef.current);
          }}
        >
          Clear Signature
        </button>
      </div>
    </div>
  );
}
