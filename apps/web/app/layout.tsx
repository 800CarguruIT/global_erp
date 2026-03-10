import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import React from "react";
import { ThemeProvider, GlobalUiProvider, TranslationProvider } from "@repo/ui";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Global ERP AI Hub",
  description: "AutoGuru internal AI control center"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const linkusSdkUrl = process.env.NEXT_PUBLIC_LINKUS_SDK_URL?.trim();

  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {linkusSdkUrl ? <Script src={linkusSdkUrl} strategy="afterInteractive" /> : null}
        <GlobalUiProvider>
          <TranslationProvider>
            <ThemeProvider>
              {children}
              <Toaster richColors position="top-right" />
            </ThemeProvider>
          </TranslationProvider>
        </GlobalUiProvider>
      </body>
    </html>
  );
}
