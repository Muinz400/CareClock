"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

/*
  Caregiver equivalent of useAdminSession — same getUser -> profiles ->
  redirect shape, called once by CaregiverShell rather than per-page. One
  structural difference from the admin version: every caregiver page
  revolves around one specific employees row (clock_logs/schedules are
  scoped by employee_id, not by role), so this hook resolves both profile
  and employee and exposes both.

  - no user, or profile lookup fails -> /login
  - profile.role !== "employee" -> /home (the canonical Operations Deck
    admin destination — not the legacy /admin -> /admin/dashboard hop)
  - profile resolves as "employee" but no matching employees row exists:
    this is a data problem, not an auth problem, so it surfaces as the
    same "error" state AdminShell already uses for unexpected failures,
    rather than redirecting to /login as employee/clock's own inline
    check does today. Deliberate, small divergence — flagged, not silent.

  No middleware, no @supabase/ssr, no server-side auth.
*/

export type CaregiverProfile = {
  id: string;
  org_id: string;
  role: string;
  full_name: string | null;
};

export type CaregiverEmployee = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  is_active: boolean;
};

export type CaregiverSessionValue = {
  profile: CaregiverProfile;
  employee: CaregiverEmployee;
};

type CaregiverSessionState =
  | { status: "loading" }
  | { status: "ready"; value: CaregiverSessionValue }
  | { status: "error"; message: string };

export const CaregiverSessionContext = createContext<CaregiverSessionValue | null>(null);

export function useCaregiverSessionState(): CaregiverSessionState {
  const router = useRouter();
  const [state, setState] = useState<CaregiverSessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, org_id, role, full_name")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        if (profileError || !profile) {
          router.push("/login");
          return;
        }

        const caregiverProfile = profile as CaregiverProfile;

        if (caregiverProfile.role !== "employee") {
          router.push("/home");
          return;
        }

        const { data: employee, error: employeeError } = await supabase
          .from("employees")
          .select("id, user_id, name, email, is_active")
          .eq("user_id", user.id)
          .single();

        if (cancelled) return;

        if (employeeError || !employee) {
          setState({
            status: "error",
            message: "We couldn't find your employee record. Please contact your administrator.",
          });
          return;
        }

        const caregiverEmployee = employee as CaregiverEmployee;

        if (!caregiverEmployee.is_active) {
          setState({
            status: "error",
            message: "Your employee account is inactive. Please contact your administrator.",
          });
          return;
        }

        setState({
          status: "ready",
          value: { profile: caregiverProfile, employee: caregiverEmployee },
        });
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setState({
          status: "error",
          message: "Something went wrong loading your session.",
        });
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return state;
}

/** Consumer hook for pages rendered inside CaregiverShell. */
export function useCaregiverProfile(): CaregiverSessionValue {
  const value = useContext(CaregiverSessionContext);

  if (!value) {
    throw new Error("useCaregiverProfile must be used within CaregiverShell");
  }

  return value;
}
