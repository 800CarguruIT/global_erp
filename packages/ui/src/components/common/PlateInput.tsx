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
  const inputBorderClass = theme.inputBorder;
  const inputBgClass = theme.inputBg;
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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
      <div>
        <div className="space-y-2 ">
          <div className="text-xs font-semibold text-muted-foreground">
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
      <div className="flex flex-col justify-center gap-2 md:col-span-2 ">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground space-y-2">
          <span>State or City</span>
          {/* <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/30 text-[10px] text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            title="Enable one or both to load options for the country"
            aria-label="State or City info"
          >
            <svg viewBox="0 0 24 24" className="h-1 w-1" aria-hidden="true">
              <path
                d="M12 8.5h.01M11 11h2v5h-2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button> */}
        </div>
        <div className="grid gap-4 text-xs sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1 transition ${inputBorderClass} ${inputBgClass} ${
              showState ? "ring-1 ring-primary/30" : "hover:bg-muted/30"
            }`}
          >
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
            <span className="font-semibold">State</span>
            {showState && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Selected
              </span>
            )}
          </label>
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1 transition ${inputBorderClass} ${inputBgClass} ${
              showCity ? "ring-1 ring-primary/30" : "hover:bg-muted/30"
            }`}
          >
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
            <span className="font-semibold">City</span>
            {showCity && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Selected
              </span>
            )}
          </label>
        </div>
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
