"use client";

import React from "react";
import { SmartSelect } from "./SmartSelect";
import { ReferenceData } from "@repo/ai-core/client";

export type CountrySelectProps = {
  value?: string;
  onChange: (iso2: string | undefined) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
};

export function CountrySelect({ value, onChange, label, placeholder, required }: CountrySelectProps) {
  const options = ReferenceData.ReferenceCountries.allCountries.map((c) => ({
    value: c.iso2,
    label: `${c.name} (${c.dialCode})`,
  }));
  return (
    <SmartSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label ?? "Country"}
      placeholder={placeholder ?? "Select country"}
      required={required}
    />
  );
}
