"use client";

import React from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  const handleClick = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/auth/login");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className ?? "text-sm text-gray-300 hover:underline"}
    >
      Logout
    </button>
  );
}
