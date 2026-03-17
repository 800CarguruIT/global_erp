"use client";

import React from "react";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="max-w-md text-center space-y-4 p-8">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          This section encountered an error. Your other pages still work fine.
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/50 font-mono">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
