const GLOBAL_PERMISSION_PREFIX = "global.";

export function isGlobalPermissionKey(permissionKey: string) {
  return permissionKey.startsWith(GLOBAL_PERMISSION_PREFIX);
}

export function filterGlobalPermissionKeys(permissionKeys: string[]) {
  return permissionKeys.filter(isGlobalPermissionKey);
}
