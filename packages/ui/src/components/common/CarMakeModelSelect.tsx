"use client";

import React, { useMemo } from "react";
import { SmartSelect } from "./SmartSelect";
import { ReferenceData } from "@repo/ai-core/client";

export type CarMakeModelValue = { make: string; model?: string; year?: number | null };

export type CarMakeModelSelectProps = {
  value?: CarMakeModelValue;
  onChange: (value: CarMakeModelValue) => void;
  minYear?: number;
  maxYear?: number;
};

export function CarMakeModelSelect({ value, onChange, minYear = 1980, maxYear }: CarMakeModelSelectProps) {
  const current = value ?? { make: "", model: "", year: undefined };
  const yearMax = maxYear ?? new Date().getFullYear() + 1;

  const makeOptions = ReferenceData.ReferenceCarMakes.carMakes.map((m) => ({ value: m.name, label: m.name }));
  const selectedMake = ReferenceData.ReferenceCarMakes.carMakes.find((m) => m.name === current.make);
  const modelOptions = (selectedMake?.models ?? []).map((m) => ({ value: m.name, label: m.name }));

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = yearMax; y >= minYear; y -= 1) arr.push(y);
    return arr;
  }, [minYear, yearMax]);
  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <SmartSelect
        label="Make"
        value={current.make}
        onChange={(make) => onChange({ ...current, make: make ?? "", model: undefined })}
        options={makeOptions}
        placeholder="Select make"
        allowCustomValue
      />
      <SmartSelect
        label="Model"
        value={current.model}
        onChange={(model) => onChange({ ...current, model: model ?? "" })}
        options={modelOptions}
        placeholder="Select model"
        allowCustomValue
      />
      <SmartSelect
        label="Year"
        value={current.year ? String(current.year) : ""}
        onChange={(year) => onChange({ ...current, year: year ? Number(year) : null })}
        options={yearOptions}
        placeholder="Year"
        allowCustomValue
      />
    </div>
  );
}
