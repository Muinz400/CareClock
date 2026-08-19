"use client";

import { tokens } from "../../styles/tokens";
import { Panel } from "../ui";

/*
  Shared shift form used by /scheduling/new and /scheduling/[id]/edit.
  Purely presentational and controlled — every field's value and change
  handler comes from the parent page, which also owns validation, payload
  construction, and the actual Supabase call. This component doesn't
  decide what's valid or what gets saved; it only renders the exact same
  fields the original inline form had, now shared instead of duplicated.
*/

export type ShiftFormValues = {
  employeeId: string;
  houseName: string;
  workDate: string;
  startTime: string;
  endTime: string;
  mileage: string;
  isOuting: boolean;
  dailyLog: string;
};

type Employee = { id: string; name: string };

type ShiftFormProps = {
  mode: "create" | "edit";
  employees: Employee[];
  values: ShiftFormValues;
  onFieldChange: <K extends keyof ShiftFormValues>(field: K, value: ShiftFormValues[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
};

export default function ShiftForm({ mode, employees, values, onFieldChange, onSubmit, onCancel, submitting, error }: ShiftFormProps) {
  return (
    <Panel padding="md" style={{ maxWidth: 640 }}>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: tokens.spacing[4] }}>
        {error && (
          <div
            role="alert"
            style={{
              padding: tokens.spacing[3],
              border: `1px solid ${tokens.colors.danger}`,
              borderRadius: tokens.radius.structural,
              color: tokens.colors.dangerInk,
              background: tokens.colors.dangerSoft,
              fontSize: tokens.typography.size.sm,
            }}
          >
            {error}
          </div>
        )}

        <FormField label="Employee">
          <select value={values.employeeId} onChange={(e) => onFieldChange("employeeId", e.target.value)} style={inputStyle}>
            <option value="">Select employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="House">
          <input
            type="text"
            placeholder="Ex: Maple House"
            value={values.houseName}
            onChange={(e) => onFieldChange("houseName", e.target.value)}
            style={inputStyle}
          />
        </FormField>

        <FormField label="Work Date">
          <input type="date" value={values.workDate} onChange={(e) => onFieldChange("workDate", e.target.value)} style={inputStyle} />
        </FormField>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacing[3] }}>
          <FormField label="Start Time">
            <input type="time" value={values.startTime} onChange={(e) => onFieldChange("startTime", e.target.value)} style={inputStyle} />
          </FormField>
          <FormField label="End Time">
            <input type="time" value={values.endTime} onChange={(e) => onFieldChange("endTime", e.target.value)} style={inputStyle} />
          </FormField>
        </div>

        <FormField label="Mileage">
          <input
            type="number"
            placeholder="Leave blank if none"
            value={values.mileage}
            onChange={(e) => onFieldChange("mileage", e.target.value)}
            style={inputStyle}
          />
        </FormField>

        <label style={{ display: "flex", alignItems: "center", gap: tokens.spacing[2], fontSize: tokens.typography.size.sm }}>
          <input type="checkbox" checked={values.isOuting} onChange={(e) => onFieldChange("isOuting", e.target.checked)} />
          <span>Mark as outing</span>
        </label>

        <FormField label="Daily Log">
          <textarea
            placeholder="Add context for the shift, tasks, notes, or reminders"
            value={values.dailyLog}
            onChange={(e) => onFieldChange("dailyLog", e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </FormField>

        <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={submitting}
            className="cc-btn"
            style={{ ...actionButtonStyle, background: tokens.signal.base, color: "#1a1305", border: "none" }}
          >
            {submitting ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Shift"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="cc-btn"
            style={{ ...actionButtonStyle, background: "transparent", color: tokens.paper.inkMuted, border: `1px solid ${tokens.paper.border}` }}
          >
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: tokens.typography.size.sm }}>
      <span style={{ fontWeight: tokens.typography.weight.medium, color: tokens.paper.inkMuted }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
  borderRadius: tokens.radius.structural,
  border: `1px solid ${tokens.paper.borderStrong}`,
  background: tokens.paper.surface,
  color: tokens.paper.ink,
  fontSize: tokens.typography.size.sm,
};

const actionButtonStyle: React.CSSProperties = {
  padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: tokens.radius.structural,
  fontSize: tokens.typography.size.sm,
  fontWeight: tokens.typography.weight.semibold,
};
