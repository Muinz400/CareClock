"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

/*
  Extracted verbatim from the pre-split /login page — same
  signInWithPassword call, same error handling, same self-healing profile
  creation, same role detection, same redirect targets (/admin, /employee).
  Shared by /login/admin and /login/employee so the two visually distinct
  forms never duplicate this logic. Redirect targets intentionally stay at
  the legacy /admin and /employee routes for now — /home and /today are
  still Step 2 shell-preview placeholders with no real functionality, so
  routing real logins there would be a functional regression. Switching
  these two destinations is its own explicit future migration step.
*/
export function useLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError || !signInData.user) {
        alert(signInError?.message || "Login failed.");
        setLoading(false);
        return;
      }

      const user = signInData.user;

      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, full_name, org_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        const { data: employee, error: employeeError } = await supabase
          .from("employees")
          .select("id, org_id, name, email")
          .eq("user_id", user.id)
          .single();

        if (employeeError || !employee) {
          alert("Profile not found.");
          setLoading(false);
          return;
        }

        const { error: insertProfileError } = await supabase
          .from("profiles")
          .insert([
            {
              id: user.id,
              org_id: employee.org_id,
              full_name: employee.name || "Employee",
              role: "employee",
            },
          ]);

        if (insertProfileError) {
          alert(insertProfileError.message);
          setLoading(false);
          return;
        }

        const profileResult = await supabase
          .from("profiles")
          .select("id, role, full_name, org_id")
          .eq("id", user.id)
          .single();

        profile = profileResult.data;
        profileError = profileResult.error;
      }

      if (profileError || !profile) {
        alert("Profile not found.");
        setLoading(false);
        return;
      }

      if (profile.role === "admin") {
        router.push("/home");
      } else {
        router.push("/today");
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong during login.");
    } finally {
      setLoading(false);
    }
  }

  return { email, setEmail, password, setPassword, loading, handleSubmit };
}
