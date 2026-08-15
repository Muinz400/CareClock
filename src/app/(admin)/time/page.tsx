"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "../../../components/ui";

/*
  /time is a canonical section URL, not a real page — same client-side
  redirect shim already used by legacy /admin -> /admin/dashboard. Redirects
  to /time/live, the only real sub-route this round.
*/
export default function TimeIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/time/live");
  }, [router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <LoadingSpinner size="lg" label="Loading Time & Attendance..." />
    </div>
  );
}
