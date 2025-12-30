"use client";

import React from "react";
import { useTheme } from "../theme";

type CardProps = {
  title?: string;
  className?: string;
  children: React.ReactNode;
};

export function Card({ title, className = "", children }: CardProps) {
  const { theme } = useTheme();

  return (
    <div
      className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-5 sm:p-6 ${className}`}
    >
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">
            {title}
          </h2>
        </div>
      )}
      {children}
    </div>
  );
}
