"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "../../../supabaseClient";
import { formatAppDateTime } from "../../../lib/time";
import { tokens } from "../../../styles/tokens";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";

const LocationMap = dynamic(() => import("../../../components/LocationMap"), {
  ssr: false,
});

const JOB_SITE = {
  name: "Client Home — Marysville",
  latitude: 48.03957,
  longitude: -122.14665,
};

const ALLOWED_RADIUS_METERS = 50000;

type EmployeeRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  is_active: boolean;
};

type Feedback = { type: "success" | "error"; message: string };

// Pure function of its arguments only — no reference to component state,
// props, or hooks — so it lives at module scope rather than being
// recreated (and needing to be a hook dependency) on every render.
function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export default function ClockPage() {
  const router = useRouter();

  const [status, setStatus] = useState<string>("Not clocked in");
  const [location, setLocation] = useState<string>("");
  const [distanceAway, setDistanceAway] = useState<string | null>(null);
  const [employeeLat, setEmployeeLat] = useState<number | null>(null);
  const [employeeLng, setEmployeeLng] = useState<number | null>(null);
  const [lastClockIn, setLastClockIn] = useState<string | null>(null);
  const [lastClockOut, setLastClockOut] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadEmployeeAndClockLog = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      setAuthReady(true);
      return;
    }

    const { data: employeeRow, error: employeeError } = await supabase
      .from("employees")
      .select("id, user_id, name, email, is_active")
      .eq("user_id", user.id)
      .single();

    if (employeeError || !employeeRow) {
      console.error(employeeError);
      setFeedback({ type: "error", message: "Employee record not found." });
      router.push("/login");
      setAuthReady(true);
      return;
    }

    setEmployee(employeeRow);

    if (!employeeRow.is_active) {
      setInactive(true);
      setAuthReady(true);
      return;
    }

    const { data, error } = await supabase
      .from("clock_logs")
      .select("id, employee_id, clock_in, clock_out, latitude, longitude")
      .eq("employee_id", employeeRow.id)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setLastClockIn(data.clock_in ?? null);
      setLastClockOut(data.clock_out ?? null);
      setStatus(data.clock_in && !data.clock_out ? "Clocked In" : "Clocked Out");
    } else {
      setStatus("Not clocked in");
    }

    setAuthReady(true);
  }, [router]);

  // Passive/incidental location updates never touch `feedback` — clearing it
  // here would risk wiping a meaningful error the user hasn't acted on yet.
  const updateLocationState = useCallback((lat: number, lng: number) => {
    setEmployeeLat(lat);
    setEmployeeLng(lng);
    setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    const metersAway = getDistanceMeters(
      lat,
      lng,
      JOB_SITE.latitude,
      JOB_SITE.longitude
    );

    setDistanceAway(metersAway.toFixed(0));
    return metersAway;
  }, []);

  const checkCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateLocationState(lat, lng);
      },
      (err) => {
        console.error(err);
      }
    );
  }, [updateLocationState]);

  useEffect(() => {
    checkCurrentLocation();
    void loadEmployeeAndClockLog();
  }, [checkCurrentLocation, loadEmployeeAndClockLog]);

  const handleClockIn = async () => {
    // A new action begins here — clear any stale feedback from a previous attempt.
    setFeedback(null);

    if (!employee) {
      setFeedback({ type: "error", message: "Employee not loaded yet." });
      return;
    }

    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: "Geolocation not supported" });
      return;
    }

    setLoading(true);

    const { data: existingOpenShift, error: existingShiftError } = await supabase
      .from("clock_logs")
      .select("id")
      .eq("employee_id", employee.id)
      .is("clock_out", null)
      .maybeSingle();

    if (existingShiftError) {
      setFeedback({ type: "error", message: existingShiftError.message });
      setLoading(false);
      return;
    }

    if (existingOpenShift) {
      setFeedback({ type: "error", message: "You are already clocked in." });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          const metersAway = updateLocationState(lat, lng);

          if (metersAway > ALLOWED_RADIUS_METERS) {
            setFeedback({
              type: "error",
              message: `Clock in blocked. You are ${metersAway.toFixed(
                0
              )} meters away from ${JOB_SITE.name}. You must be within ${ALLOWED_RADIUS_METERS} meters.`,
            });
            setLoading(false);
            return;
          }

          const nowIso = new Date().toISOString();

          const { error } = await supabase.from("clock_logs").insert([
            {
              employee_id: employee.id,
              latitude: lat,
              longitude: lng,
              clock_in: nowIso,
            },
          ]);

          if (error) {
            setFeedback({ type: "error", message: error.message });
            setLoading(false);
            return;
          }

          setStatus("Clocked In");
          setLastClockIn(nowIso);
          setLastClockOut(null);
          setFeedback({ type: "success", message: "Clocked in successfully." });
        } catch (err) {
          console.error(err);
          setFeedback({ type: "error", message: "Failed to clock in" });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error(err);
        setFeedback({ type: "error", message: "Unable to get location" });
        setLoading(false);
      }
    );
  };

  const handleClockOut = async () => {
    // A new action begins here — clear any stale feedback from a previous attempt.
    setFeedback(null);

    if (!employee) {
      setFeedback({ type: "error", message: "Employee not loaded yet." });
      return;
    }

    setLoading(true);

    try {
      const { data: openShift, error: openShiftError } = await supabase
        .from("clock_logs")
        .select("id, clock_in, clock_out")
        .eq("employee_id", employee.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .maybeSingle();

      if (openShiftError) {
        setFeedback({ type: "error", message: openShiftError.message });
        setLoading(false);
        return;
      }

      if (!openShift) {
        setFeedback({ type: "error", message: "You are not currently clocked in." });
        setStatus("Clocked Out");
        setLoading(false);
        return;
      }

      const nowIso = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("clock_logs")
        .update({ clock_out: nowIso })
        .eq("id", openShift.id);

      if (updateError) {
        setFeedback({ type: "error", message: updateError.message });
        setLoading(false);
        return;
      }

      setStatus("Clocked Out");
      setLastClockOut(nowIso);
      setFeedback({ type: "success", message: "Clocked out successfully." });
      await loadEmployeeAndClockLog();
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to clock out." });
    } finally {
      setLoading(false);
    }
  };

  const isWithinRadius =
    distanceAway !== null && Number(distanceAway) <= ALLOWED_RADIUS_METERS;

  if (!authReady) {
    return (
      <main style={{ padding: tokens.spacing[6] }}>
        <LoadingSpinner size="lg" label="Loading employee session..." />
      </main>
    );
  }

  if (inactive) {
    return (
      <main style={{ padding: tokens.spacing[6], maxWidth: tokens.container.lg, margin: "0 auto" }}>
        <Alert variant="danger">
          Your employee account is inactive. Please contact your administrator.
        </Alert>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: tokens.spacing[6],
        maxWidth: tokens.container.lg,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: tokens.spacing[3],
          flexWrap: "wrap",
          marginBottom: tokens.spacing[6],
        }}
      >
        <h1 style={{ margin: 0, fontSize: tokens.typography.size["3xl"] }}>
          CareClock Employee Time
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: tokens.spacing[3],
            flexWrap: "wrap",
          }}
        >
          {employee && (
            <span
              style={{
                fontSize: tokens.typography.size.sm,
                color: tokens.colors.inkMuted,
              }}
            >
              {employee.name}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>

      {feedback?.type === "error" && (
        <div style={{ marginBottom: tokens.spacing[4] }}>
          <Alert variant="danger">{feedback.message}</Alert>
        </div>
      )}

      {/*
        Success confirmation deliberately does NOT use the Alert component:
        Alert renders role="alert" (assertive), which is correct for errors
        but would interrupt a screen-reader user for a routine confirmation.
        This reuses Alert's success visual styling via the same tokens, with
        role="status"/aria-live="polite" instead.
      */}
      {feedback?.type === "success" && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            marginBottom: tokens.spacing[4],
            background: tokens.colors.successSoft,
            border: `1px solid ${tokens.colors.success}`,
            color: tokens.colors.successInk,
            borderRadius: tokens.radius.lg,
            padding: tokens.spacing[4],
            fontFamily: tokens.typography.fontFamily,
            fontSize: tokens.typography.size.base,
          }}
        >
          {feedback.message}
        </div>
      )}

      <Card variant="raised" padding="lg">
        {/*
          Narrowly scoped to the values that actually change (status, GPS
          location, distance, location check) — Job site / Allowed radius
          below are static for the life of the page and stay outside this
          region so the whole card isn't re-announced on every update.
        */}
        <div aria-live="polite" aria-atomic="true">
          <p style={{ margin: `0 0 ${tokens.spacing[3]}` }}>
            <strong>Status:</strong>{" "}
            <Badge variant={status === "Clocked In" ? "success" : "neutral"}>
              {status}
            </Badge>
          </p>

          <p style={{ margin: `0 0 ${tokens.spacing[2]}` }}>
            <strong>GPS location:</strong>{" "}
            {location || "Location will appear after clock in"}
          </p>

          <p style={{ margin: `0 0 ${tokens.spacing[2]}` }}>
            <strong>Distance away:</strong>{" "}
            {distanceAway ? `${distanceAway} meters` : "Calculating..."}
          </p>

          <p style={{ margin: `0 0 ${tokens.spacing[4]}` }}>
            <strong>Location Check:</strong>{" "}
            <Badge
              variant={
                distanceAway && Number(distanceAway) <= ALLOWED_RADIUS_METERS
                  ? "success"
                  : "danger"
              }
            >
              {distanceAway
                ? Number(distanceAway) <= ALLOWED_RADIUS_METERS
                  ? "✅ Within job site radius"
                  : "❌ Outside job site radius"
                : "Checking..."}
            </Badge>
          </p>
        </div>

        <p
          style={{
            margin: `0 0 ${tokens.spacing[2]}`,
            color: tokens.colors.inkMuted,
            fontSize: tokens.typography.size.sm,
          }}
        >
          <strong>Job site:</strong> {JOB_SITE.name}
        </p>

        <p
          style={{
            margin: `0 0 ${tokens.spacing[5]}`,
            color: tokens.colors.inkMuted,
            fontSize: tokens.typography.size.sm,
          }}
        >
          <strong>Allowed radius:</strong> {ALLOWED_RADIUS_METERS} meters
        </p>

        <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap" }}>
          <Button
            variant="primary"
            style={{
              background: tokens.colors.success,
              minHeight: tokens.spacing[9],
              flex: "1 1 140px",
            }}
            onClick={handleClockIn}
            disabled={!authReady || loading || !isWithinRadius || status === "Clocked In"}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" label="" aria-hidden="true" />
                Working...
              </>
            ) : (
              "Clock In"
            )}
          </Button>

          <Button
            variant="danger"
            style={{ minHeight: tokens.spacing[9], flex: "1 1 140px" }}
            onClick={handleClockOut}
            disabled={!authReady || loading || status !== "Clocked In"}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" label="" aria-hidden="true" />
                Working...
              </>
            ) : (
              "Clock Out"
            )}
          </Button>
        </div>
      </Card>

      {employeeLat !== null && employeeLng !== null && (
        <div style={{ marginTop: tokens.spacing[5] }}>
          <LocationMap
            employeeLat={employeeLat}
            employeeLng={employeeLng}
            jobLat={JOB_SITE.latitude}
            jobLng={JOB_SITE.longitude}
            radiusMeters={ALLOWED_RADIUS_METERS}
          />
        </div>
      )}

      <div style={{ marginTop: tokens.spacing[4] }}>
        <Card variant="raised" padding="lg">
          <h3
            style={{
              marginTop: 0,
              marginBottom: tokens.spacing[3],
              fontSize: tokens.typography.size.lg,
            }}
          >
            Latest Time Activity
          </h3>
          <p style={{ margin: `${tokens.spacing[1]} 0` }}>
            <strong>Last Clock In:</strong> {formatAppDateTime(lastClockIn)}
          </p>
          <p style={{ margin: `${tokens.spacing[1]} 0` }}>
            <strong>Last Clock Out:</strong> {formatAppDateTime(lastClockOut)}
          </p>
        </Card>
      </div>
    </main>
  );
}
