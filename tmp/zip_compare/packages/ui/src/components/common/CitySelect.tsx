"use client";

import React from "react";
import { SmartSelect } from "./SmartSelect";
import { ReferenceData } from "@repo/ai-core/client";

export type CitySelectProps = {
  countryIso2?: string;
  value?: string;
  onChange: (name: string | undefined) => void;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  placeholderDisabled?: string;
  required?: boolean;
};

export function CitySelect({
  countryIso2,
  value,
  onChange,
  label,
  disabled,
  placeholder,
  placeholderDisabled,
  required,
}: CitySelectProps) {
  const cities = countryIso2
    ? ReferenceData.ReferenceCities.citiesForCountry(countryIso2)
    : [];
  const options = cities.map((c) => ({ value: c.name, label: c.name }));
  const isDisabled = disabled || !countryIso2;
  return (
    <SmartSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label ?? "City"}
      placeholder={
        countryIso2
          ? placeholder ?? "Select city"
          : placeholderDisabled ?? "Select country first"
      }
      disabled={isDisabled}
      required={required}
    />
  );
}
