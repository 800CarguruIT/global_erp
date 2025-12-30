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

  function setLocationMode(next: "state" | "city" | "both") {
    onChange({
      ...value,
      locationMode: next,
      state: next === "city" ? "" : value.state ?? "",
      city: next === "state" ? "" : value.city ?? "",
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <div>
        <div className="text-xs font-semibold text-muted-foreground">Country Code</div>
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
      <div className="flex flex-col justify-center gap-1">
        <div className="text-xs font-semibold text-muted-foreground">State or City</div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showState}
              onChange={(e) => {
                const next = e.target.checked
                  ? showCity
                    ? "both"
                    : "state"
                  : showCity
                  ? "city"
                  : "state";
                setLocationMode(next);
              }}
              disabled={!hasCountry}
            />
            <span>State</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showCity}
              onChange={(e) => {
                const next = e.target.checked
                  ? showState
                    ? "both"
                    : "city"
                  : showState
                  ? "state"
                  : "city";
                setLocationMode(next);
              }}
              disabled={!hasCountry}
            />
            <span>City</span>
          </label>
        </div>
        <div className="text-[11px] text-muted-foreground">Enable one or both to load options for the country</div>
      </div>
      {showState && (
      <div>
        <div className="text-xs font-semibold text-muted-foreground">State / Province</div>
        <select
          className={theme.input}
          value={value.state ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              // If the other field is already shown, keep "both" so it doesn't disappear
              locationMode:
                locationMode === "city" || locationMode === "both" ? "both" : "state",
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
        <div className="text-xs font-semibold text-muted-foreground">City</div>
        <select
          className={theme.input}
          value={value.city ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              locationMode:
                locationMode === "state" || locationMode === "both" ? "both" : "city",
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
        <div className="text-xs font-semibold text-muted-foreground">Series (A-Z / 0-9)</div>
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
        <div className="text-xs font-semibold text-muted-foreground">Number</div>
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
