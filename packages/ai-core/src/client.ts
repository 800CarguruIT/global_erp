// Client-safe exports (no DB or Node-specific modules)
export * as ReferenceData from "./reference-data";
export * as ScopeModules from "./shared/scopes-and-modules";

// Types-only re-exports that do not pull in runtime DB deps
export * from "./crm/leads/types";
export * from "./crm/leads/jobFlows";
export * from "./workshop/inspections/types";
export * from "./workshop/estimates/types";
export * from "./workshop/parts/types";
export * from "./workshop/workorders/types";
export * from "./workshop/qualityCheck/types";
export * from "./workshop/invoices/types";
export * from "./workshop/gatepass/types";
export * from "./workshop/quotes/types";
export * from "./workshop/procurement/types";
export * from "./workshop/inventory/types";
export * from "./workshop/inventory-requests/types";
export * from "./operations/fleet/types";
export * from "./operations/bays/types";
export * from "./accounting/types";
export * from "./accounting/configTypes";
