import { MODULES, isModuleEnabled, type ScopeContext } from "@repo/ai-core/shared/scopes-and-modules";

export function getModulesForScope(scope: ScopeContext) {
  return Object.values(MODULES).filter((module) => isModuleEnabled(scope.scope, module.key));
}
