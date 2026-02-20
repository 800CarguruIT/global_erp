"use client";

import React, { useMemo } from "react";
import { ReferenceData } from "@repo/ai-core/client";
import { useTheme } from "../../theme";

export type PlateValue = {
  country: string;
  locationMode?: "state" | "city" | "both";
  state?: string;
  city?: string;
  series?: string;
  number?: string;
};

type PlateInputProps = {
  value: PlateValue;
  onChange: (value: PlateValue) => void;
};

export function PlateInput({ value, onChange }: PlateInputProps) {
  const { theme } = useTheme();
  const labelClass = "mb-1 text-sm font-medium text-foreground/90";
  const countries = ReferenceData.ReferenceCountries.allCountries;
  const states = ReferenceData.ReferenceStates.allStates;
  const cities = ReferenceData.ReferenceCities?.allCities ?? [];

  const hasCountry = Boolean(value.country);
  const statesForCountry = useMemo(() => {
    if (!value.country) return [];
    // prefer helper if available
    if (ReferenceData.ReferenceStates.statesForCountry) {
      return ReferenceData.ReferenceStates.statesForCountry(value.country);
    }
    return states.filter((s) => s.countryIso2?.toLowerCase() === value.country?.toLowerCase());
  }, [states, value.country]);
  const citiesForCountry = useMemo(() => {
    if (!value.country) return [];
    if (ReferenceData.ReferenceCities?.citiesForCountry) {
      return ReferenceData.ReferenceCities.citiesForCountry(value.country);
    }
    return cities.filter((c) => c.countryIso2?.toLowerCase() === value.country?.toLowerCase());
  }, [cities, value.country]);
  const defaultLocationMode = hasCountry ? (statesForCountry.length ? "state" : "city") : "state";
  const locationMode = value.locationMode ?? defaultLocationMode;
  const showCity = locationMode === "city" || locationMode === "both";
  const showState = locationMode === "state" || locationMode === "both";
  const locationOptionsCity = citiesForCountry;
  const locationOptionsState = statesForCountry;
  const emptyLocationLabelCity = "No cities";
  const emptyLocationLabelState = "No states";
  const isStateChecked = locationMode === "state" || locationMode === "both";
  const isCityChecked = locationMode === "city" || locationMode === "both";

  function setLocationMode(next: "state" | "city" | "both") {
    onChange({
      ...value,
      locationMode: next,
      state: next === "city" ? "" : value.state ?? "",
      city: next === "state" ? "" : value.city ?? "",
    });
  }

  function toggleLocationCheckbox(kind: "state" | "city") {
    if (!hasCountry) return;
    const nextState = kind === "state" ? !isStateChecked : isStateChecked;
    const nextCity = kind === "city" ? !isCityChecked : isCityChecked;
    // Keep at least one option selected.
    if (!nextState && !nextCity) return;
    if (nextState && nextCity) {
      setLocationMode("both");
      return;
    }
    if (nextState) {
      setLocationMode("state");
      return;
    }
    setLocationMode("city");
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
      <div>
        <div className="space-y-2 ">
          <div className={labelClass}>
            Country Code
          </div>
        </div>
        <select
          className={theme.input}
          value={value.country}
          onChange={(e) =>
            onChange({
              ...value,
              country: e.target.value,
              locationMode: undefined,
              state: "",
              city: "",
            })
          }
        >
          <option value="">Select</option>
          {countries.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {c.iso2} {c.name ? `- ${c.name}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col justify-center gap-2 md:col-span-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
          <span>State / City</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              { key: "state", label: "State", checked: isStateChecked },
              { key: "city", label: "City", checked: isCityChecked },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              role="checkbox"
              aria-checked={item.checked}
              disabled={!hasCountry}
              onClick={() => toggleLocationCheckbox(item.key)}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-md px-3 py-1.5 font-medium transition ${
                item.checked
                  ? "bg-primary/12 text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/55"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] ${
                  item.checked ? "border-primary/50 bg-primary/20 text-primary" : "border-muted-foreground/30 bg-muted/30 text-transparent"
                }`}
              >
                ✓
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {showState && (
      <div>
        <div className={labelClass}>State / Province</div>
        <select
          className={theme.input}
          value={value.state ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              locationMode: locationMode === "both" ? "both" : "state",
              state: e.target.value,
            })
          }
          disabled={!hasCountry || locationOptionsState.length === 0}
        >
            <option value="">Select</option>
            {locationOptionsState.map((s) => (
              <option key={`${s.countryIso2}-${s.code}`} value={s.code}>
                {s.code} {s.name ? `- ${s.name}` : ""}
              </option>
            ))}
            {locationOptionsState.length === 0 && <option value="">{emptyLocationLabelState}</option>}
          </select>
        </div>
      )}
      {showCity && (
      <div>
        <div className={labelClass}>City</div>
        <select
          className={theme.input}
          value={value.city ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              locationMode: locationMode === "both" ? "both" : "city",
              city: e.target.value,
            })
          }
          disabled={!hasCountry || locationOptionsCity.length === 0}
        >
            <option value="">Select</option>
            {locationOptionsCity.map((c) => (
              <option key={`${c.countryIso2}-${c.name}`} value={c.name}>
                {c.name}
              </option>
            ))}
            {locationOptionsCity.length === 0 && <option value="">{emptyLocationLabelCity}</option>}
          </select>
        </div>
      )}
      <div>
        <div className={labelClass}>Series (A-Z / 0-9)</div>
        <input
          className={theme.input}
          value={value.series ?? ""}
          onChange={(e) => {
            const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            onChange({ ...value, series: cleaned });
          }}
          placeholder="ABC"
          disabled={!hasCountry}
        />
      </div>
      <div>
        <div className={labelClass}>Number</div>
        <input
          className={theme.input}
          value={value.number ?? ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onChange({ ...value, number: digits });
          }}
          placeholder="12345"
          maxLength={12}
          disabled={!hasCountry}
        />
      </div>
    </div>
  );
}
