"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAdminProfile } from "../../../../../hooks/useAdminSession";
import { supabase } from "../../../../../supabaseClient";
import { tokens } from "../../../../../styles/tokens";
import { LoadingSpinner, EmptyState } from "../../../../../components/ui";
import ShiftForm, { type ShiftFormValues } from "../../../../../components/scheduling/ShiftForm";

/*
  Dedicated Edit Shift page (Scheduling A follow-up). Preserves the exact
  edit validation/payload/update behavior that used to live inline on
  /scheduling — only where the form lives, and how the shift is loaded,
  changed.

  The shift lookup is scoped by BOTH id and org_id (new — this is a
  fresh route with no prior org-scoped context to inherit, unlike the
  old inline form which only ever operated on already-org-scoped rows
  already sitting in the parent page's loaded state). The update
  mutation itself is unchanged: .update(payload).eq("id", shiftId),
  matching the original exactly — this is read-scoping only, not a
  change to write semantics.
*/

type Employee = { id: string; name: string };
type ScheduleRow = {
  id: string;
  employee_id: string;
  house_name: string | null;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  mileage: number | null;
  is_outing: boolean | null;
  daily_log: string | null;
};

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

export default function EditShiftPage() {
  const { org_id: orgId } = useAdminProfile();
  const router = useRouter();
  const params = useParams();
  const shiftId = params?.id as string;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ShiftFormValues>(EMPTY_VALUES);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);

      const { data: employeeRows, error: employeeError } = await supabase
        .from("employees")
        .select("id, name")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (employeeError) {
        setLoadError(employeeError.message);
        setLoading(false);
        return;
      }

      setEmployees((employeeRows ?? []) as Employee[]);

      const { data: shiftRow, error: shiftError } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", shiftId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (cancelled) return;

      if (shiftError) {
        setLoadError(shiftError.message);
        setLoading(false);
        return;
      }

      if (!shiftRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const row = shiftRow as ScheduleRow;

      setValues({
        employeeId: row.employee_id,
        houseName: row.house_name ?? "",
        workDate: row.work_date?.slice(0, 10) ?? "",
        startTime: row.start_time ?? "",
        endTime: row.end_time ?? "",
        mileage: row.mileage != null ? String(row.mileage) : "",
        isOuting: Boolean(row.is_outing),
        dailyLog: row.daily_log ?? "",
      });

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId, shiftId]);

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

    const { error } = await supabase.from("schedules").update(payload).eq("id", shiftId);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push("/scheduling");
  }

  const backLink = (
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
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading shift..." />
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        {backLink}
        <EmptyState
          title="Shift not found"
          description="This shift doesn't exist or isn't part of your organization."
          style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        {backLink}
        <div
          role="alert"
          style={{
            padding: tokens.spacing[4],
            border: `1px solid ${tokens.colors.danger}`,
            borderRadius: tokens.radius.structural,
            color: tokens.colors.dangerInk,
            background: tokens.colors.dangerSoft,
            fontSize: tokens.typography.size.sm,
          }}
        >
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div>
      {backLink}

      <div style={{ marginBottom: tokens.spacing[6] }}>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
          Edit Shift
        </h1>
      </div>

      <ShiftForm
        mode="edit"
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
