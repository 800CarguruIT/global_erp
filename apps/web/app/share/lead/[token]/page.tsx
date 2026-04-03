"use client";

import { useEffect, useState } from "react";

type LeadData = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  carPlateNumber: string | null;
  carModel: string | null;
  leadType: string;
  leadStatus: string;
  leadStage: string;
  serviceType: string | null;
  pickupFrom: string | null;
  pickupGoogleLocation: string | null;
  dropoffTo: string | null;
  dropoffGoogleLocation: string | null;
  createdAt: string;
};

export default function PublicLeadSharePage({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => setToken(p?.token ?? null));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/lead/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Invalid link" : r.status === 410 ? "Link expired" : "Failed to load");
        return r.json();
      })
      .then((d) => setLead(d.data ?? null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="text-4xl mb-3">🔗</div>
          <div className="text-lg font-semibold text-foreground/80">{error ?? "Link not found"}</div>
          <div className="text-sm text-muted-foreground mt-1">This share link is invalid or has expired.</div>
        </div>
      </div>
    );
  }

  const stageLabel = (lead.leadStage ?? "").replace(/_/g, " ");
  const typeLabel = (lead.serviceType ?? lead.leadType ?? "").replace(/_/g, " ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/30 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-lg">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/50 mb-1">Recovery Request</div>
          <h1 className="text-xl font-bold">{lead.customerName}</h1>
          {lead.customerPhone && (
            <a href={`tel:${lead.customerPhone}`} className="text-sm text-sky-400 hover:underline">{lead.customerPhone}</a>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-6 sm:px-6">
        {/* Status */}
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-blue-500/15 border border-blue-500/25 px-3 py-1 text-sm font-semibold text-blue-400 uppercase">
            {typeLabel}
          </span>
          <span className="rounded-lg bg-muted/40 border border-border px-3 py-1 text-sm font-medium text-foreground/70 capitalize">
            {stageLabel}
          </span>
        </div>

        {/* Car */}
        {lead.carPlateNumber && (
          <div className="rounded-2xl border border-border bg-card/30 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground/50 mb-1">Vehicle</div>
            <div className="text-lg font-bold">{lead.carPlateNumber}</div>
            {lead.carModel && <div className="text-sm text-muted-foreground">{lead.carModel}</div>}
          </div>
        )}

        {/* Pickup */}
        {(lead.pickupFrom || lead.pickupGoogleLocation) && (
          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-4">
            <div className="text-xs uppercase tracking-wider text-blue-400/60 mb-2">Pickup Location</div>
            {lead.pickupFrom && <div className="text-sm text-foreground/80 mb-2">{lead.pickupFrom}</div>}
            {lead.pickupGoogleLocation && (
              <a
                href={lead.pickupGoogleLocation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-500/20 border border-blue-500/30 py-3 text-sm font-semibold text-blue-400 active:bg-blue-500/30"
              >
                📍 Open in Google Maps
              </a>
            )}
          </div>
        )}

        {/* Dropoff */}
        {(lead.dropoffTo || lead.dropoffGoogleLocation) && (
          <div className="rounded-2xl border border-purple-500/15 bg-purple-500/5 p-4">
            <div className="text-xs uppercase tracking-wider text-purple-400/60 mb-2">Dropoff Location</div>
            {lead.dropoffTo && <div className="text-sm text-foreground/80 mb-2">{lead.dropoffTo}</div>}
            {lead.dropoffGoogleLocation && (
              <a
                href={lead.dropoffGoogleLocation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-purple-500/20 border border-purple-500/30 py-3 text-sm font-semibold text-purple-400 active:bg-purple-500/30"
              >
                📍 Open in Google Maps
              </a>
            )}
          </div>
        )}

        {/* Call button */}
        {lead.customerPhone && (
          <a
            href={`tel:${lead.customerPhone}`}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 py-4 text-base font-bold text-emerald-400 active:bg-emerald-500/25"
          >
            📞 Call Customer
          </a>
        )}

        {/* Footer */}
        <div className="pt-4 text-center text-xs text-muted-foreground/30">
          Created {new Date(lead.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
