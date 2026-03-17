"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ReferenceData } from "@repo/ai-core/client";
import { useTheme } from "../../theme";
import { useOnClickOutside } from "../../hooks/useOnClickOutside";

export type PhoneValue = { dialCode: string; nationalNumber: string };

export type PhoneInputProps = {
  countryIso2?: string;
  value?: PhoneValue;
  onChange: (value: PhoneValue) => void;
  label?: string;
  disabled?: boolean;
};

export function PhoneInput({ countryIso2, value, onChange, label, disabled }: PhoneInputProps) {
  const { theme } = useTheme();
  const countries = ReferenceData.ReferenceCountries.allCountries;
  const countryOptions = useMemo(() => countries.filter((c) => c.dialCode), [countries]);
  const normalize = (code: string) => {
    const trimmed = code?.trim?.() ?? "";
    if (!trimmed) return "";
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  };
  const dialCodeNormalized = useMemo(() => {
    const fromValue = normalize(value?.dialCode ?? "");
    if (fromValue) return fromValue;
    if (!countryIso2) return "";
    const c = countryOptions.find((c) => c.iso2 === countryIso2);
    return normalize(c?.dialCode ?? "");
  }, [value?.dialCode, countryIso2, countryOptions]);
  const [local, setLocal] = useState(value?.nationalNumber ?? "");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  useOnClickOutside(dropdownRef, () => setOpen(false));

  useEffect(() => {
    setLocal(value?.nationalNumber ?? "");
  }, [value?.nationalNumber]);

  const filteredOptions = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return [];
    return countryOptions.filter(
      (c) =>
        c.dialCode?.toLowerCase().includes(term) ||
        c.name?.toLowerCase().includes(term) ||
        c.iso2?.toLowerCase().includes(term)
    );
  }, [filter, countryOptions]);

  function emit(newLocal: string) {
    onChange({ dialCode: dialCodeNormalized || "", nationalNumber: newLocal });
  }

  function updateDial(code: string) {
    const normalized = normalize(code);
    onChange({ dialCode: normalized, nationalNumber: local });
    setFilter("");
    setOpen(false);
  }

  return (
    <div className="space-y-1">
      {label && <div className="text-xs uppercase opacity-80">{label}</div>}
      <div className="flex items-stretch gap-2 relative">
        <button
          type="button"
          className={`${theme.input} w-28 max-w-[7rem] text-left cursor-pointer ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
        >
          {dialCodeNormalized || "+___"}
        </button>
        {open && !disabled && (
          <div
            ref={dropdownRef}
            className="absolute z-20 mt-1 w-64 rounded-md border bg-background shadow-lg max-h-64 overflow-auto"
          >
            <input
              className={`${theme.input} m-2`}
              placeholder="Search code or country"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="divide-y divide-border">
              {filter.trim() === "" && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Type a code (e.g. 971) or country</div>
              )}
              {filter.trim() !== "" &&
                filteredOptions.map((c) => (
                  <button
                    type="button"
                    key={`${c.iso2}-${c.dialCode}`}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => updateDial(c.dialCode ?? "")}
                  >
                    <span className="text-muted-foreground uppercase text-xs">{c.iso2}</span>
                    <span className="font-medium">{normalize(c.dialCode ?? "")}</span>
                    <span className="text-xs text-muted-foreground truncate">{c.name}</span>
                  </button>
                ))}
              {filter.trim() !== "" && filteredOptions.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
              )}
            </div>
          </div>
        )}
        <input
          className={`${theme.input} flex-1 min-w-0 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          value={local}
          disabled={disabled}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            setLocal(digits);
            emit(digits);
          }}
          placeholder="Phone number"
        />
      </div>
    </div>
  );
}
