"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../supabaseClient";

type PageStatus = "resolving" | "ready" | "submitting" | "invalid" | "success";

// Safety-net only: used when the URL genuinely carries an invite attempt but
// Supabase never confirms or rejects it (e.g. the connection drops mid-exchange).
// It is not the primary signal for deciding a link is invalid — see below.
const SESSION_RESOLUTION_SAFETY_NET_MS = 10000;
const MIN_PASSWORD_LENGTH = 8;

function parseAuthParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);

  const errorDescription =
    hash.get("error_description") ||
    search.get("error_description") ||
    hash.get("error") ||
    search.get("error");

  const hasInviteParams =
    hash.has("access_token") ||
    hash.get("type") === "invite" ||
    hash.get("type") === "recovery" ||
    search.has("code");

  return { errorDescription, hasInviteParams };
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>("resolving");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const resolvedRef = useRef(false);

  useEffect(() => {
    resolvedRef.current = false;

    function markReady() {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setStatus("ready");
    }

    function markInvalid(message?: string) {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      if (message) setError(message);
      setStatus("invalid");
    }

    const { errorDescription, hasInviteParams } = parseAuthParams();

    // Supabase's own Auth server appends error/error_description to the
    // redirect URL when it rejects an invite link (expired, already used,
    // etc.) — this is a definitive signal, not a guess.
    if (errorDescription) {
      markInvalid(decodeURIComponent(errorDescription));
      return;
    }

    // No invite/recovery parameters in the URL at all means there is nothing
    // for Supabase to resolve (e.g. someone navigated here directly) — no
    // reason to show a loading state while waiting for something that will
    // never happen.
    if (!hasInviteParams) {
      markInvalid();
      return;
    }

    async function checkInitialSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        markReady();
      }
    }

    checkInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        markReady();
      }
    });

    const timeout = setTimeout(() => {
      markInvalid();
    }, SESSION_RESOLUTION_SAFETY_NET_MS);

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (status !== "ready") return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setStatus("submitting");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    setStatus("success");

    setTimeout(() => {
      router.push("/employee/clock");
    }, 1500);
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: 20 }}>
      <h1 style={{ marginBottom: 8 }}>Set Your Password</h1>

      {status === "resolving" && (
        <p style={{ opacity: 0.75 }}>Verifying your invitation...</p>
      )}

      {status === "invalid" && (
        <p style={{ color: "crimson" }}>
          This invitation link is invalid or has expired. Please contact your
          administrator for a new invitation.
        </p>
      )}

      {(status === "ready" || status === "submitting") && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ marginTop: 0, opacity: 0.75 }}>
            Welcome to CareClock. Choose a password to finish setting up your
            account.
          </p>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "submitting"}
              style={inputStyle}
              autoComplete="new-password"
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={status === "submitting"}
              style={inputStyle}
              autoComplete="new-password"
              required
            />
          </label>

          {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={status === "submitting"}
            style={{
              padding: "12px 20px",
              background: "#111",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: status === "submitting" ? "not-allowed" : "pointer",
              opacity: status === "submitting" ? 0.7 : 1,
            }}
          >
            {status === "submitting" ? "Setting password..." : "Set password"}
          </button>
        </form>
      )}

      {status === "success" && (
        <p style={{ color: "#166534" }}>
          Password set successfully. Redirecting you to your dashboard...
        </p>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
};
