import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import { ThemeProvider, GlobalUiProvider, TranslationProvider } from "@repo/ui";

export const metadata: Metadata = {
  title: "Global ERP AI Hub",
  description: "AutoGuru internal AI control center"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <GlobalUiProvider>
          <TranslationProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </TranslationProvider>
        </GlobalUiProvider>
      </body>
    </html>
  );
}
