"use client";

import React from "react";
import { SmartSelect } from "./SmartSelect";
import { ReferenceData } from "@repo/ai-core/client";

export type PartBrandSelectProps = {
  value?: string;
  onChange: (value: string | undefined) => void;
  label?: string;
};

export function PartBrandSelect({ value, onChange, label }: PartBrandSelectProps) {
  const options = ReferenceData.ReferencePartBrands.partBrands.map((b) => ({ value: b.name, label: b.name }));
  return (
    <SmartSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label ?? "Brand"}
      placeholder="Select brand"
      allowCustomValue
    />
  );
}
