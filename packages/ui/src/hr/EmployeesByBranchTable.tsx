"use client";

import React from "react";

export interface EmployeesByBranchTableProps {
  rows: Array<{
    branchId: string;
    branchName: string;
    count: number;
  }>;
}

export function EmployeesByBranchTable({ rows }: EmployeesByBranchTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="py-2 pl-3 pr-4 text-left">Branch</th>
            <th className="py-2 px-4 text-left">Employees</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-3 px-4 text-sm text-muted-foreground">
                No employees found.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.branchId} className="border-b last:border-0">
                <td className="py-2 pl-3 pr-4">{row.branchName}</td>
                <td className="py-2 px-4">{row.count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
