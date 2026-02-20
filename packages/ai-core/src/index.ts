// packages/ai-core/src/index.ts
export * from "./db";
export * as Ai from "./ai";
export * as Dialer from "./dialer/service";
export * as DialerTypes from "./dialer/types";
export * as Integrations from "./integrations";
export * as Channels from "./channels/service";
export * as ChannelTypes from "./channels/types";
export * as IntegrationEvents from "./integrations/events";
export * as HrEmployees from "./hr/employees/service";
export * as HrEmployeeTypes from "./hr/employees/types";
export * as Rbac from "./auth/rbac/service";
export * as RbacTypes from "./auth/rbac/types";
export type { ScopeContext } from "./auth/rbac/types";
export * as Users from "./auth/users/service";
export * as Accounting from "./accounting/service";
export * as AccountingTypes from "./accounting/types";
export * as AccountingConfig from "./accounting/configRepository";
export type { CompanyAccountingSettings } from "./accounting/configTypes";
export * as UserRepository from "./auth/users/repository";
export * as Monitoring from "./monitoring/service";
export * as MonitoringTypes from "./monitoring/types";
export * as Company from "./company/service";
export * as CompanyTypes from "./company/types";
export * as Crm from "./crm/service";
export * as CrmTypes from "./crm/types";
export * as Leads from "./crm/leads/repository";
export * as LeadTypes from "./crm/leads/types";
export * as LeadJobFlows from "./crm/leads/jobFlows";
export * as CallCenter from "./call-center/service";
export * as CallCenterTypes from "./call-center/types";
export * as Vendors from "./vendors/service";
export * as VendorTypes from "./vendors/types";
export * as Branches from "./branches/repository";
export type { Branch } from "./branches/types";
export * as ScopeModules from "./shared/scopes-and-modules";
export * as WorkshopInspections from "./workshop/inspections/repository";
export type {
  Inspection,
  InspectionItem,
  InspectionStatus,
} from "./workshop/inspections/types";
export * as WorkshopEstimates from "./workshop/estimates/repository";
export type {
  Estimate,
  EstimateItem,
  EstimateStatus,
  EstimateItemStatus,
} from "./workshop/estimates/types";
export * as WorkshopParts from "./workshop/parts/repository";
export type { PartCatalogItem, PartsRequirementRow, ProcurementStatus } from "./workshop/parts/types";
export * as WorkshopWorkOrders from "./workshop/workorders/repository";
export type {
  WorkOrder,
  WorkOrderItem,
  WorkOrderStatus,
  WorkLineStatus,
} from "./workshop/workorders/types";
export * as WorkshopQualityCheck from "./workshop/qualityCheck/repository";
export type {
  QualityCheck,
  QualityCheckItem,
  QualityCheckStatus,
  QualityCheckItemStatus,
} from "./workshop/qualityCheck/types";
export * as WorkshopInvoices from "./workshop/invoices/repository";
export type { Invoice, InvoiceItem, InvoiceStatus } from "./workshop/invoices/types";
export * as WorkshopGatepass from "./workshop/gatepass/repository";
export type { Gatepass, GatepassStatus, GatepassHandoverType } from "./workshop/gatepass/types";
export * as WorkshopProcurement from "./workshop/procurement/repository";
export type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, PurchaseOrderType } from "./workshop/procurement/types";
export * as WorkshopInventory from "./workshop/inventory/repository";
export type {
  InventoryLocation,
  InventoryLocationType,
  InventoryStockRow,
  InventoryTransfer,
  InventoryTransferItem,
  InventoryTransferStatus,
  InventoryReceiptLabel,
} from "./workshop/inventory/types";
export * as Fleet from "./operations/fleet/repository";
export type {
  FleetVehicle,
  FleetBranchSummary,
  FleetStatus,
  FleetVehicleType,
} from "./operations/fleet/types";
export * as Bays from "./operations/bays/repository";
export type { WorkshopBay, BayBranchSummary, BayStatus, BayType } from "./operations/bays/types";
export * as ReferenceData from "./reference-data";
export * as HrReports from "./reports/hrReports";
export * as Reports from "./reports/companyReports";
export * as TranslationsRepo from "./translations/translationsRepo";
export * as TranslationsService from "./translations/translationsService";
export * as MarketingTemplates from "./marketing/templates/repository";
export * as CampaignBuilder from "./marketing/campaigns/builderRepository";
export * as CampaignSchedules from "./marketing/campaigns/scheduleRepository";
export * as CampaignScheduler from "./marketing/campaigns/scheduler";
export * as CampaignPerformance from "./marketing/campaigns/performanceRepository";
export * as MarketingSettings from "./marketing/settings/repository";
export * as MarketingSegments from "./marketing/segments/repository";
export * as Push from "./push/service";
export * as PushTypes from "./push/types";

export { getOpenAIClient } from "./ai/client";
export { canUseAi } from "./ai/policy";
export * as Files from "./files/repository";
export type { FileKind, FileRecord } from "./files/types";


