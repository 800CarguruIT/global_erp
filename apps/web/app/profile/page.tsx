"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/global/settings/org-profile");
  }, [router]);
  return null;
}
