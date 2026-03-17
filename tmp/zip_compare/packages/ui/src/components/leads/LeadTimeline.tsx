"use client";

import React from "react";
import type { LeadEvent } from "@repo/ai-core/crm/leads/types";

type LeadTimelineVariant = "default" | "centered";
type Props = { events: LeadEvent[]; variant?: LeadTimelineVariant };

export function LeadTimeline({ events, variant = "default" }: Props) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No activity recorded for this lead yet.</p>;

  const ordered = [...events].sort((a, b) => {
    const orderA = typeof (a.eventPayload as any)?.order === "number" ? (a.eventPayload as any).order : null;
    const orderB = typeof (b.eventPayload as any)?.order === "number" ? (b.eventPayload as any).order : null;
    if (orderA != null && orderB != null) return orderA - orderB;
    if (orderA != null) return -1;
    if (orderB != null) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  if (variant === "centered") {
    return (
      <ol className="space-y-6">
        {ordered.map((event, index) => {
          const title = getTimelineTitle(event);
          const dateLabel = formatDate(event.createdAt);
          const isLast = index === ordered.length - 1;
          return (
            <li key={event.id} className="relative">
              <div className="flex items-start gap-4">
                <div className="relative flex w-6 flex-col items-center">
                  {!isLast && <span className="absolute top-7 h-full w-px bg-border" />}
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs leading-none shadow-sm">
                    *
                  </span>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="text-xs font-semibold text-muted-foreground">{dateLabel}</div>
                  <div className="text-sm font-semibold text-foreground">{title}</div>
                  <TimelineBody event={event} variant="centered" />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="relative border-l pl-4 text-sm">
      {ordered.map((event) => {
        const title = getTimelineTitle(event);
        const createdAt = new Date(event.createdAt).toLocaleString();
        const actor =
          event.actorName ||
          event.actorUserId ||
          (event.eventPayload && typeof (event.eventPayload as any).actorUserId === "string"
            ? (event.eventPayload as any).actorUserId
            : null);
        return (
          <li key={event.id} className="mb-4 ml-1">
            <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{title}</span>
              <div className="flex flex-col items-end gap-1 text-right">
                {actor && <span className="text-[11px] text-muted-foreground">User: {actor}</span>}
                <span className="text-xs text-muted-foreground">{createdAt}</span>
              </div>
            </div>
            <TimelineBody event={event} variant="default" />
          </li>
        );
      })}
    </ol>
  );
}

function TimelineBody({ event, variant }: { event: LeadEvent; variant: LeadTimelineVariant }) {
  const payload = event.eventPayload ?? {};

  if (variant === "centered") {
    const details = getTimelineDetails(event);
    if (!details.length) return null;
    return (
      <div className="mt-1 space-y-1 text-sm text-muted-foreground">
        {details.map((detail, idx) => (
          <div key={`${event.id}-detail-${idx}`}>{detail}</div>
        ))}
      </div>
    );
  }

  if (event.eventType === "remark") {
    const role = payload.role === "customer" ? "Customer" : "Agent";
    const message = payload.message ?? "";
    const previous = payload.previous ?? null;
    return (
      <div className="mt-2 space-y-1 rounded-md border bg-background/40 p-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
            {role}
          </span>
          <span className="text-[11px] text-muted-foreground">Remark</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message || "(empty remark)"}</p>
        {previous ? (
          <p className="text-[11px] text-muted-foreground">Previous: {String(previous)}</p>
        ) : null}
      </div>
    );
  }

  if (event.eventType === "updated" && Array.isArray(payload.changes)) {
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Fields updated</div>
        <ul className="mt-1 space-y-1">
          {payload.changes.map((change: any, idx: number) => (
            <li key={idx} className="flex flex-wrap items-center gap-1">
              <span className="font-semibold capitalize">{change.field}:</span>
              <span className="text-muted-foreground line-through">{formatValue(change.from)}</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="font-medium text-foreground">{formatValue(change.to)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (event.eventType === "created") {
    const leadType = payload.leadType ? String(payload.leadType).toUpperCase() : null;
    const assignedTo = payload.assignedTo ?? payload.owner ?? null;
    const leadSource = payload.leadSource ?? payload.source ?? null;
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Lead created</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {leadType && <Badge label={`Type: ${leadType}`} />}
          {leadSource && <Badge label={`Source: ${leadSource}`} />}
          {assignedTo && <Badge label={`Assigned: ${assignedTo}`} />}
        </div>
      </div>
    );
  }

  if (event.eventType === "accepted") {
    const acceptedAt = payload.acceptedAt ? new Date(payload.acceptedAt).toLocaleString() : null;
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Lead accepted</div>
        {payload.actor && (
          <div className="mt-1 text-[11px] text-muted-foreground">By: {payload.actor}</div>
        )}
        {acceptedAt && <div className="mt-1 text-[11px] text-muted-foreground">{acceptedAt}</div>}
      </div>
    );
  }

  if (event.eventType === "car_in") {
    const checkinAt = payload.checkinAt ? new Date(payload.checkinAt).toLocaleString() : null;
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Car checked in</div>
        {payload.actor && (
          <div className="mt-1 text-[11px] text-muted-foreground">By: {payload.actor}</div>
        )}
        {checkinAt && <div className="mt-1 text-[11px] text-muted-foreground">{checkinAt}</div>}
      </div>
    );
  }

  if (event.eventType === "status_step") {
    const label = payload.label ?? "Status updated";
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">{label}</div>
        {payload.actor && (
          <div className="mt-1 text-[11px] text-muted-foreground">By: {payload.actor}</div>
        )}
      </div>
    );
  }

  if (event.eventType === "customer_details_requested") {
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Customer details requested</div>
      </div>
    );
  }

  if (event.eventType === "customer_details_approved") {
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Customer details approved</div>
      </div>
    );
  }

  if (event.eventType === "customer_details_hidden") {
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Customer details hidden</div>
      </div>
    );
  }

  if (event.eventType === "car_check") {
    return (
      <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs">
        <div className="font-semibold text-foreground">Car check saved</div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
      Activity recorded.
    </div>
  );
}

function getTimelineTitle(event: LeadEvent) {
  const payload = event.eventPayload ?? {};
  switch (event.eventType) {
    case "remark":
      return "Remark added";
    case "accepted":
      return "Accepted";
    case "car_in":
      return "Car In";
    case "status_step":
      return payload.label ?? "Status update";
    case "customer_details_requested":
      return "Customer details requested";
    case "customer_details_approved":
      return "Customer details approved";
    case "customer_details_hidden":
      return "Customer details hidden";
    case "car_check":
      return "Car check";
    case "updated":
      return "Lead updated";
    case "created":
      return "Lead created";
    default:
      return event.eventType.replace(/_/g, " ");
  }
}

function formatValue(val: any): string {
  if (val === null || val === undefined || val === "") return "(empty)";
  return String(val);
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">{label}</span>;
}

function formatDate(dateValue: string | Date) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function getTimelineDetails(event: LeadEvent): string[] {
  const payload = event.eventPayload ?? {};
  const details: string[] = [];

  if (event.eventType === "remark") {
    const role = payload.role === "customer" ? "Customer" : "Agent";
    const message = payload.message ?? "";
    if (message) {
      details.push(`${role} remark: ${message}`);
    } else {
      details.push(`${role} remark: (empty remark)`);
    }
    if (payload.previous) {
      details.push(`Previous: ${String(payload.previous)}`);
    }
    return details;
  }

  if (event.eventType === "updated" && Array.isArray(payload.changes)) {
    payload.changes.forEach((change: any) => {
      details.push(
        `${String(change.field)}: ${formatValue(change.from)} -> ${formatValue(change.to)}`
      );
    });
    return details;
  }

  if (event.eventType === "created") {
    const leadType = payload.leadType ? String(payload.leadType).toUpperCase() : null;
    const assignedTo = payload.assignedTo ?? payload.owner ?? null;
    const leadSource = payload.leadSource ?? payload.source ?? null;
    if (leadType) details.push(`Type: ${leadType}`);
    if (leadSource) details.push(`Source: ${leadSource}`);
    if (assignedTo) details.push(`Assigned: ${assignedTo}`);
    return details;
  }

  if (event.eventType === "accepted") {
    if (payload.actor) details.push(`By: ${String(payload.actor)}`);
    if (payload.acceptedAt) details.push(new Date(payload.acceptedAt).toLocaleString());
    return details;
  }

  if (event.eventType === "car_in") {
    if (payload.actor) details.push(`By: ${String(payload.actor)}`);
    if (payload.checkinAt) details.push(new Date(payload.checkinAt).toLocaleString());
    return details;
  }

  if (event.eventType === "status_step") {
    if (payload.actor) details.push(`By: ${String(payload.actor)}`);
    return details;
  }

  return details;
}
