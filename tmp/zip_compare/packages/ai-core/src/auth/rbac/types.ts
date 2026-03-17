export type RoleScope = "global" | "company" | "branch" | "vendor";

export interface RoleRow {
  id: string;
  name: string;
  key: string;
  scope: RoleScope;
  company_id: string | null;
  branch_id: string | null;
  vendor_id: string | null;
  description: string | null;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PermissionRow {
  id: string;
  key: string;
  description: string;
}

export interface UserRoleRow {
  user_id: string;
  role_id: string;
}

export type ScopeContext = {
  scope: RoleScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
};

export type CreateRoleInput = {
  name: string;
  key: string;
  scope: RoleScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
  description?: string | null;
  permissionKeys: string[];
};

export type UpdateRoleInput = {
  name?: string;
  description?: string | null;
  permissionKeys?: string[];
};
