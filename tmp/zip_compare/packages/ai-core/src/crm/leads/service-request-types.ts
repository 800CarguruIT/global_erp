export const serviceRequestTypes = ["inspection_only", "inspection_minor", "inspection_major"] as const;

export type ServiceRequestType = (typeof serviceRequestTypes)[number];

export const serviceRequestTypeLabels: Record<ServiceRequestType, string> = {
  inspection_only: "Inspection Only",
  inspection_minor: "Inspection + Minor Service",
  inspection_major: "Inspection + Major Service",
};
