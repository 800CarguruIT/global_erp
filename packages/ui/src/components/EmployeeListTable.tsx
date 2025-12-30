"use client";

import React from "react";
import { useTheme } from "../theme";
import { Card } from "./Card";
import { useI18n } from "../i18n";

export type EmployeeScope = "global" | "company" | "branch" | "vendor";

export type EmployeeListItem = {
  id: string;
  auto_code: string;
  full_name: string;
  title: string | null;
  division: string | null;
  department: string | null;
  employee_type: string;
  basic_salary: number;
  allowance_total: number;
  gov_fee_total: number;
  salary_grand_total: number;
  image_file_id?: string | null;
};

type Props = {
  items: EmployeeListItem[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function EmployeeListTable({ items, onEdit, onDelete }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const cell = "px-3 py-2 text-sm";

  return (
    <Card title={t("hr.employees.table.title")}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="text-xs uppercase opacity-70">
              <th className={cell}>{t("hr.employees.table.id")}</th>
              <th className={cell}>{t("hr.employees.table.name")}</th>
              <th className={cell}>{t("hr.employees.table.title")}</th>
              <th className={cell}>{t("hr.employees.table.divisionDept")}</th>
              <th className={cell}>{t("hr.employees.table.type")}</th>
              <th className={cell}>{t("hr.employees.table.basic")}</th>
              <th className={cell}>{t("hr.employees.table.allowances")}</th>
              <th className={cell}>{t("hr.employees.table.govFees")}</th>
              <th className={cell}>{t("hr.employees.table.grandTotal")}</th>
              <th className={cell}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/5">
                <td className={cell}>{item.auto_code}</td>
                <td className={cell}>
                  <div className="flex items-center gap-2">
                    {item.image_file_id && (
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-white/10">
                        <img
                          src={item.image_file_id}
                          alt={item.full_name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <span>{item.full_name}</span>
                  </div>
                </td>
                <td className={cell}>{item.title ?? "-"}</td>
                <td className={cell}>
                  {item.division ?? "-"} / {item.department ?? "-"}
                </td>
                <td className={cell}>{item.employee_type}</td>
                <td className={cell}>{Number(item.basic_salary).toFixed(2)}</td>
                <td className={cell}>{Number(item.allowance_total).toFixed(2)}</td>
                <td className={cell}>{Number(item.gov_fee_total).toFixed(2)}</td>
                <td className={cell} title={String(item.salary_grand_total)}>
                  {Number(item.salary_grand_total).toFixed(2)}
                </td>
                <td className={cell}>
                  <div className="flex gap-2">
                    {onEdit && (
                      <button
                        className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                        onClick={() => onEdit(item.id)}
                      >
                        {t("hr.employees.table.edit")}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-100 hover:bg-red-500/30"
                        onClick={() => onDelete(item.id)}
                      >
                        {t("hr.employees.table.delete")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="py-3 text-center text-sm opacity-70">{t("hr.employees.table.empty")}</div>
        )}
      </div>
    </Card>
  );
}
