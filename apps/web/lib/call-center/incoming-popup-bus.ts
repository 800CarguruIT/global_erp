export type IncomingPopupEvent = {
  id: string;
  providerCallId: string;
  providerKey: string;
  direction: "inbound" | "outbound";
  status: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  aiText?: string | null;
  pickupHint?: string | null;
  createdAt: string;
};

import {
  getRecentIncomingPopupEvents as getRecentIncomingPopupEventsRaw,
  publishIncomingPopupEvent as publishIncomingPopupEventRaw,
  subscribeIncomingPopupEvent as subscribeIncomingPopupEventRaw,
} from "./incoming-popup-bus.shared.js";

export function publishIncomingPopupEvent(event: IncomingPopupEvent): void {
  publishIncomingPopupEventRaw(event);
}

export function subscribeIncomingPopupEvent(
  listener: (event: IncomingPopupEvent) => void
): () => void {
  return subscribeIncomingPopupEventRaw(listener);
}

export function getRecentIncomingPopupEvents(options?: {
  companyId?: string | null;
  maxAgeMs?: number;
  limit?: number;
}): IncomingPopupEvent[] {
  return getRecentIncomingPopupEventsRaw(options) as IncomingPopupEvent[];
}
