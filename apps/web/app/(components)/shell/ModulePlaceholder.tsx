"use client";

import { useScope } from "../../../context/scope/ScopeProvider";

export function ModulePlaceholder({ title, description }: { title: string; description?: string }) {
  const scope = useScope();

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">
        {title}{" "}
        <span className="text-sm font-normal text-muted-foreground">({scope.scope})</span>
      </h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <p className="text-xs text-muted-foreground">
        Placeholder page. Scope context: companyId = {scope.companyId ?? "–"}, branchId ={" "}
        {scope.branchId ?? "–"}, vendorId = {scope.vendorId ?? "–"}.
      </p>
    </div>
  );
}
