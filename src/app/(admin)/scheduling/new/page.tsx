"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminProfile } from "../../../../hooks/useAdminSession";
import { supabase } from "../../../../supabaseClient";
import { tokens } from "../../../../styles/tokens";
import { LoadingSpinner } from "../../../../components/ui";
import ShiftForm, { type ShiftFormValues } from "../../../../components/scheduling/ShiftForm";

/*
  Dedicated Create Shift page (Scheduling A follow-up). Preserves the
  exact create validation/payload/insert behavior that used to live
  inline on /scheduling — only where the form lives changed.

  ?house=&?date= prefill House/Work Date only, matching the board's
  + Add cell click — never Employee, which still defaults to the first
  org employee alphabetically, exactly as it did inline. Nothing is
  auto-saved from query params; the admin still submits explicitly.
*/

type Employee = { id: string; name: string };

const EMPTY_VALUES: ShiftFormValues = {
  employeeId: "",
  houseName: "",
  workDate: "",
  startTime: "",
  endTime: "",
  mileage: "",
  isOuting: false,
  dailyLog: "",
};

function NewShiftPageContent() {
  const { org_id: orgId } = useAdminProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ShiftFormValues>(EMPTY_VALUES);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Employee[];
      setEmployees(rows);

      const houseParam = searchParams.get("house");
      const dateParam = searchParams.get("date");

      setValues((prev) => ({
        ...prev,
        employeeId: rows.length > 0 ? rows[0].id : "",
        houseName: houseParam ?? prev.houseName,
        workDate: dateParam ?? prev.workDate,
      }));

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function handleFieldChange<K extends keyof ShiftFormValues>(field: K, value: ShiftFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!values.employeeId) {
      setError("Please select an employee.");
      return;
    }

    if (!values.workDate) {
      setError("Please select a work date.");
      return;
    }

    setSaving(true);

    const parsedMileage = values.mileage.trim() === "" ? null : Number(values.mileage);

    if (parsedMileage !== null && Number.isNaN(parsedMileage)) {
      setError("Mileage must be a valid number.");
      setSaving(false);
      return;
    }

    const payload = {
      org_id: orgId,
      employee_id: values.employeeId,
      house_name: values.houseName.trim() || null,
      work_date: values.workDate,
      start_time: values.startTime || null,
      end_time: values.endTime || null,
      mileage: parsedMileage,
      is_outing: values.isOuting,
      daily_log: values.dailyLog.trim() || null,
    };

    const { error } = await supabase.from("schedules").insert([payload]);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push("/scheduling");
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading..." />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/scheduling"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: tokens.spacing[5],
          fontSize: tokens.typography.size.sm,
          fontWeight: tokens.typography.weight.semibold,
          color: tokens.paper.inkMuted,
          textDecoration: "none",
        }}
      >
        ← Back to Schedule
      </Link>

      <div style={{ marginBottom: tokens.spacing[6] }}>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
          New Shift
        </h1>
        <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
          Create a shift assignment.
        </p>
      </div>

      <ShiftForm
        mode="create"
        employees={employees}
        values={values}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/scheduling")}
        submitting={saving}
        error={error}
      />
    </div>
  );
}

export default function NewShiftPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
          <LoadingSpinner size="lg" label="Loading..." />
        </div>
      }
    >
      <NewShiftPageContent />
    </Suspense>
  );
}
