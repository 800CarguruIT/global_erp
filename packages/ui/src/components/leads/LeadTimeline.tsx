"use client";

import React from "react";
import type { LeadEvent } from "@repo/ai-core/crm/leads/types";

type Props = { events: LeadEvent[] };

export function LeadTimeline({ events }: Props) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No activity recorded for this lead yet.</p>;

  const ordered = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <ol className="relative border-l pl-4 text-sm">
      {ordered.map((event) => {
        const title = formatTitle(event);
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
            <TimelineBody event={event} />
          </li>
        );
      })}
    </ol>
  );
}

function TimelineBody({ event }: { event: LeadEvent }) {
  const payload = event.eventPayload ?? {};

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

  return payload ? (
    <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 p-2 text-xs">
      {JSON.stringify(payload, null, 2)}
    </pre>
  ) : null;
}

function formatTitle(event: LeadEvent) {
  switch (event.eventType) {
    case "remark":
      return "Remark added";
    case "updated":
      return "Lead updated";
    case "created":
      return "Created";
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
