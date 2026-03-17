"use client";

import React from "react";
import { SmartSelect } from "./SmartSelect";
import { ReferenceData } from "@repo/ai-core/client";

export type StateSelectProps = {
  countryIso2?: string;
  value?: string;
  onChange: (code: string | undefined) => void;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  placeholderDisabled?: string;
  required?: boolean;
};

export function StateSelect({
  countryIso2,
  value,
  onChange,
  label,
  disabled,
  placeholder,
  placeholderDisabled,
  required,
}: StateSelectProps) {
  const options =
    countryIso2 && !disabled
      ? ReferenceData.ReferenceStates.statesForCountry(countryIso2).map((s) => ({
          value: s.code,
          label: s.name,
        }))
      : [];
  const isDisabled = disabled || !countryIso2;

  return (
    <SmartSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label ?? "State / Region"}
      placeholder={
        countryIso2
          ? placeholder ?? "Select state/region"
          : placeholderDisabled ?? "Select country first"
      }
      disabled={isDisabled}
      required={required}
    />
  );
}
