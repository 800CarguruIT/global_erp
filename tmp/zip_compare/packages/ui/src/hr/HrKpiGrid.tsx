"use client";

import React from "react";
import { KpiGrid } from "../reports/KpiGrid";

interface HrKpiGridProps {
  totalEmployees: number;
  technicians: number;
  managers: number;
  callAgents: number;
}

export function HrKpiGrid({ totalEmployees, technicians, managers, callAgents }: HrKpiGridProps) {
  return (
    <KpiGrid
      items={[
        { label: "Total Employees", value: totalEmployees },
        { label: "Technicians", value: technicians },
        { label: "Managers", value: managers },
        { label: "Call Center Agents", value: callAgents },
      ]}
    />
  );
}
