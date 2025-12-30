"use client";

import React from "react";
import { CountrySelect } from "./CountrySelect";
import { CitySelect } from "./CitySelect";

export type CarPlateValue = {
  countryIso2?: string;
  cityName?: string;
  plateText: string;
};

export type CarPlateInputProps = {
  value?: CarPlateValue;
  onChange: (value: CarPlateValue) => void;
  label?: string;
};

export function CarPlateInput({ value, onChange, label }: CarPlateInputProps) {
  const v = value ?? { plateText: "" };

  function update(patch: Partial<CarPlateValue>) {
    onChange({ ...v, ...patch });
  }

  return (
    <div className="space-y-2">
      {label && <div className="text-xs font-medium text-foreground">{label}</div>}
      <div className="grid gap-3 md:grid-cols-3">
        <CountrySelect value={v.countryIso2} onChange={(c) => update({ countryIso2: c })} label="Plate country" />
        <CitySelect
          countryIso2={v.countryIso2}
          value={v.cityName}
          onChange={(c) => update({ cityName: c })}
          label="City/Emirate"
        />
        <div>
          <label className="mb-1 block text-xs font-medium">Plate</label>
          <input
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            value={v.plateText}
            onChange={(e) => update({ plateText: e.target.value })}
            placeholder="ABC-12345"
          />
        </div>
      </div>
    </div>
  );
}
