export type LeadType = "rsa" | "recovery" | "workshop";
export type LeadStatus =
  | "pending"
  | "done"
  | "open"
  | "accepted"
  | "car_in"
  | "closed"
  | "lost"
  | "processing"
  | "closed_won";

export type LeadStage =
  | "new"
  | "assigned"
  | "enroute"
  | "processing"
  | "completed"
  | "closed"
  | "follow_up"
  | "cancelled";

export type LeadSource = "call" | "inbound_call" | "outbound_call" | "website" | "ads" | "whatsapp" | "walk_in" | "referral" | "mobile_app" | "social_media" | "other";

export type LeadWorkflowRequired = {
  acceptLeadConfirmed?: boolean;
  startStepConfirmed?: boolean;
  reachedStepConfirmed?: boolean;
  preServiceSignatureConfirmed?: boolean;
  postServiceSignatureConfirmed?: boolean;
  preServiceNotes?: string | null;
  postServiceNotes?: string | null;
  updatedAt?: string | null;
};

export interface Lead {
  id: string;
  companyId: string;
  customerId: string | null;
  carId: string | null;
  recoveryDirection?: "pickup" | "dropoff" | null;
  recoveryFlow?: "customer_to_branch" | "customer_to_customer" | "branch_to_branch" | "branch_to_customer" | null;
  pickupFrom?: string | null;
  dropoffTo?: string | null;
  pickupGoogleLocation?: string | null;
  dropoffGoogleLocation?: string | null;
  branchId?: string | null;
  agentEmployeeId: string | null;
  leadType: LeadType;
  leadStatus: LeadStatus;
  leadStage: string;
  serviceType?: string | null;
  workshopVisitMode?: "walkin" | "recovery" | null;
  assignedUserId?: string | null;
  assignedAt?: string | null;
  workflowRequired?: LeadWorkflowRequired | null;
  source: string | null;
  slaMinutes: number | null;
  firstResponseAt: string | null;
  lastActivityAt: string | null;
  closedAt: string | null;
  checkinAt?: string | null;
  isLocked?: boolean;
  healthScore: number | null;
  sentimentScore: number | null;
  customerFeedback: string | null;
  agentRemark?: string | null;
  customerRemark?: string | null;
  customerDetailsRequested?: boolean;
  customerDetailsApproved?: boolean;
  carInVideo?: string | null;
  carOutVideo?: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  carPlateNumber?: string | null;
  carModel?: string | null;
  branchName?: string | null;
  agentName?: string | null;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  companyId: string;
  actorUserId: string | null;
  actorEmployeeId: string | null;
  actorName?: string | null;
  eventType: string;
  eventPayload: any;
  createdAt: string;
}
