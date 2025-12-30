"use client";

import React from "react";
import { AppLayout } from "@repo/ui";

export default function GlobalSettingsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
