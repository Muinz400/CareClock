"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

/*
  Centralizes the auth-guard sequence duplicated verbatim across every
  legacy admin page (getUser -> profiles lookup -> redirect). Called once
  by AdminShell, not by individual admin pages — the resolved profile is
  exposed to children via AdminSessionContext so a page like /home never
  needs to run its own profile fetch.

  Same semantics as every existing admin page, unchanged:
  - no user -> /login
  - profile lookup fails -> /login
  - profile.role !== "admin" -> /employee/clock (not /employee — matches
    the exact destination every legacy admin page already redirects to)

  No middleware, no @supabase/ssr, no server-side auth — same client-side
  pattern the rest of the app already uses.
*/

export type AdminProfile = {
  id: string;
  org_id: string;
  role: string;
  full_name: string | null;
};

type AdminSessionState =
  | { status: "loading" }
  | { status: "ready"; profile: AdminProfile }
  | { status: "error"; message: string };

export const AdminSessionContext = createContext<AdminProfile | null>(null);

export function useAdminSessionState(): AdminSessionState {
  const router = useRouter();
  const [state, setState] = useState<AdminSessionState>({ status: "loading" });

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

        const adminProfile = profile as AdminProfile;

        if (adminProfile.role !== "admin") {
          router.push("/employee/clock");
          return;
        }

        setState({ status: "ready", profile: adminProfile });
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

/** Consumer hook for pages rendered inside AdminShell. */
export function useAdminProfile(): AdminProfile {
  const profile = useContext(AdminSessionContext);

  if (!profile) {
    throw new Error("useAdminProfile must be used within AdminShell");
  }

  return profile;
}
