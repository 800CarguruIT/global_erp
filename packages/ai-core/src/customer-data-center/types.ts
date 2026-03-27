export type CustomerSegment = "chsc" | "non_chsc" | "insurance" | "warranty" | "unknown";

export type AssignmentStatus = "active" | "unassigned" | "reassigned";

export type AssignmentAction = "assign" | "reassign" | "unassign" | "bulk_assign" | "update";

export interface CustomerAssignmentRow {
  id: string;
  company_id: string;
  customer_id: string;
  supervisor_user_id: string | null;
  agent_user_id: string | null;
  segment: CustomerSegment;
  status: AssignmentStatus;
  assigned_at: string;
  assigned_by_user_id: string | null;
  updated_at: string;
}

export interface CustomerAssignmentHistoryRow {
  id: string;
  company_id: string;
  customer_id: string;
  assignment_id: string | null;
  old_supervisor_user_id: string | null;
  new_supervisor_user_id: string | null;
  old_agent_user_id: string | null;
  new_agent_user_id: string | null;
  old_segment: CustomerSegment | null;
  new_segment: CustomerSegment | null;
  action: AssignmentAction;
  reason: string | null;
  changed_by_user_id: string | null;
  changed_at: string;
}

export interface AssignmentListItem extends CustomerAssignmentRow {
  customer_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_type: string | null;
}

export interface UpsertCustomerAssignmentInput {
  companyId: string;
  customerId: string;
  supervisorUserId?: string | null;
  agentUserId?: string | null;
  segment?: CustomerSegment;
  status?: AssignmentStatus;
  assignedByUserId?: string | null;
  reason?: string | null;
  action?: AssignmentAction;
}

export interface ListAssignmentsFilter {
  companyId: string;
  segment?: CustomerSegment | null;
  supervisorUserId?: string | null;
  agentUserId?: string | null;
  status?: AssignmentStatus | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AssignmentListResult {
  data: AssignmentListItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DataCenterKpiFilter {
  companyId: string;
  from: Date;
  to: Date;
  segment?: CustomerSegment | null;
  supervisorUserId?: string | null;
  agentUserId?: string | null;
}

export interface DataCenterKpis {
  totalCustomers: number;
  activeCustomers: number;
  archivedCustomers: number;
  assignedCustomers: number;
  contactedCustomers: number;
  pendingCustomers: number;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  answeredRate: number;
  avgCallDurationSeconds: number | null;
}

export interface AgentPerformanceRow {
  agentUserId: string;
  agentName: string | null;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number | null;
  assignedCustomers: number;
  contactedCustomers: number;
  totalLeads: number;
  totalCollection: number;
  answerRate: number;
}

export interface AgentPerformanceReport {
  from: string;
  to: string;
  rows: AgentPerformanceRow[];
}
