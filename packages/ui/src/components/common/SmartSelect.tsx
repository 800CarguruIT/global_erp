"use client";

import React, { useMemo, useState } from "react";
import { useTheme } from "../../theme";

export type SmartSelectOption = { value: string; label: string };

export type SmartSelectProps = {
  value?: string;
  onChange: (value: string | undefined) => void;
  options: SmartSelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
};

export function SmartSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  disabled,
  allowCustomValue = false,
}: SmartSelectProps) {
  const { theme } = useTheme();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = input.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, input]);

  function handleSelect(val: string) {
    onChange(val);
    setInput("");
    setOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    setOpen(true);
    if (allowCustomValue && e.target.value === "") {
      onChange(undefined);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (allowCustomValue && input.trim().length > 0) {
        onChange(input.trim());
        setOpen(false);
        return;
      }
      if (filtered[0]) {
        handleSelect(filtered[0].value);
      }
    }
  }

  const displayValue = input || selectedOption?.label || "";

  return (
    <div className="relative">
      {label && <div className="mb-1 text-xs font-semibold uppercase opacity-80">{label}</div>}
      <div className="relative">
        <input
          className={`${theme.input} pr-10`}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={() =>
            setTimeout(() => {
              setOpen(false);
              if (!selectedOption) {
                setInput("");
              }
            }, 100)
          }
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs opacity-60">
          ▾
        </span>
      </div>
      {open && (
        <div
          className={`absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl ${theme.cardBorder} ${theme.cardBg} shadow-2xl backdrop-blur`}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm opacity-70">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(o.value)}
                className="flex w-full items-start px-3 py-2 text-left text-sm transition hover:bg-primary/10 hover:text-primary"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
