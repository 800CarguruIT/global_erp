import { EventEmitter } from "node:events";

const BUS_KEY = Symbol.for("global-erp.incoming-popup-bus");
const g = globalThis;

if (!g[BUS_KEY]) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  g[BUS_KEY] = {
    emitter,
    recent: [],
  };
}

const state = g[BUS_KEY];

export function publishIncomingPopupEvent(event) {
  const now = Date.now();
  state.recent.push(event);
  state.recent = state.recent
    .filter((item) => {
      const createdAt = Date.parse(String(item?.createdAt ?? ""));
      return Number.isFinite(createdAt) && now - createdAt <= 5 * 60 * 1000;
    })
    .slice(-200);
  state.emitter.emit("incoming", event);
}

export function subscribeIncomingPopupEvent(listener) {
  state.emitter.on("incoming", listener);
  return () => state.emitter.off("incoming", listener);
}

export function getRecentIncomingPopupEvents({ companyId, maxAgeMs = 120000, limit = 20 } = {}) {
  const now = Date.now();
  const rows = state.recent.filter((event) => {
    const createdAt = Date.parse(String(event?.createdAt ?? ""));
    if (!Number.isFinite(createdAt) || now - createdAt > maxAgeMs) return false;
    if (!companyId) return true;
    return !event?.companyId || String(event.companyId) === String(companyId);
  });
  return rows.slice(-Math.max(1, limit));
}
