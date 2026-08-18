"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { useAdminProfile } from "../../../hooks/useAdminSession";
import { supabase } from "../../../supabaseClient";
import { formatAppDate } from "../../../lib/time";
import { tokens } from "../../../styles/tokens";
import { SectionHeader, StatusBand, StatusDot, EmptyState, LoadingSpinner, Panel } from "../../../components/ui";

/*
  Payroll — migrated in place from the legacy bare /payroll route (Payroll
  A). Every calculation, mutation, and PDF export below is preserved
  exactly from the legacy implementation — only auth (now AdminShell/
  useAdminProfile, no duplicated getUser/profiles lookup) and presentation
  change. See the Payroll A audit for the full parity rationale; each
  formula here is deliberately byte-identical in logic to what it replaces,
  not simplified or "improved."

  Known, pre-existing edge-case behaviors carried forward unchanged, not
  fixed here: overlapping clock_logs can double-count hours; period
  boundaries use local browser time, not APP_TIMEZONE; missing hourly_rate
  falls back to $0; shifts are attributed to the period containing their
  clock_in even if clock_out falls outside it; open shifts are excluded
  entirely; no overtime model; no salary model. employee_payroll_settings'
  upsert also isn't given additional org-scoping hardening here — that's a
  separate, later step so calculation/mutation parity can be verified
  independently from security hardening.

  is_active is now selected purely so the ledger can label Active/Inactive
  — inactive employees are never filtered out, matching the locked product
  rule that historical payroll must remain visible.
*/

type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  hourly_rate: number | null;
  is_active: boolean;
};

type ClockLogRow = {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
};

type ScheduleRow = {
  id: string;
  employee_id: string;
  work_date: string;
  mileage: number | null;
};

type PayrollSettingsRow = {
  id: string;
  employee_id: string;
  federal_tax_percent: number;
  social_security_percent: number;
  medicare_percent: number;
  state_tax_percent: number;
  insurance_amount: number;
  dental_amount: number;
  other_deductions: number;
};

type PayrollRow = {
  employee: EmployeeRow;
  settings: PayrollSettingsRow;
  totalHours: number;
  mileageUnits: number;
  mileageRate: number;
  mileageReimbursement: number;
  grossPay: number;
  grossWithReimbursement: number;
  federalTax: number;
  socialSecurity: number;
  medicare: number;
  stateTax: number;
  fixedDeductions: number;
  totalDeductions: number;
  netPay: number;
};

const DEFAULT_MILEAGE_RATE = 0.67;

const defaultSettings = {
  federal_tax_percent: 0,
  social_security_percent: 6.2,
  medicare_percent: 1.45,
  state_tax_percent: 0,
  insurance_amount: 0,
  dental_amount: 0,
  other_deductions: 0,
};

function startOfWeekSunday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function PayrollPage() {
  const { org_id: orgId } = useAdminProfile();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [clockLogs, setClockLogs] = useState<ClockLogRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [settings, setSettings] = useState<PayrollSettingsRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    federal_tax_percent: "",
    social_security_percent: "",
    medicare_percent: "",
    state_tax_percent: "",
    insurance_amount: "",
    dental_amount: "",
    other_deductions: "",
  });

  const currentWeekStart = startOfWeekSunday();
  const currentWeekEnd = addDays(currentWeekStart, 6);

  const [periodPreset, setPeriodPreset] = useState<"week" | "biweekly" | "custom">("week");
  const [dateFrom, setDateFrom] = useState<string>(toDateInputValue(currentWeekStart));
  const [dateTo, setDateTo] = useState<string>(toDateInputValue(currentWeekEnd));
  const [mileageRate, setMileageRate] = useState<string>(String(DEFAULT_MILEAGE_RATE));

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, email, hourly_rate, is_active")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setEmployees((data ?? []) as EmployeeRow[]);
  }

  async function loadClockLogs() {
    const { data: employeeRows, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("org_id", orgId);

    if (employeeError) {
      setError(employeeError.message);
      return;
    }

    const employeeIds = (employeeRows ?? []).map((e) => e.id);
    if (employeeIds.length === 0) {
      setClockLogs([]);
      return;
    }

    const { data, error } = await supabase
      .from("clock_logs")
      .select("id, employee_id, clock_in, clock_out")
      .in("employee_id", employeeIds)
      .order("clock_in", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setClockLogs((data ?? []) as ClockLogRow[]);
  }

  async function loadSchedules() {
    const { data, error } = await supabase
      .from("schedules")
      .select("id, employee_id, work_date, mileage")
      .eq("org_id", orgId)
      .order("work_date", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setSchedules((data ?? []) as ScheduleRow[]);
  }

  async function loadPayrollSettings() {
    const { data: employeeRows, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("org_id", orgId);

    if (employeeError) {
      setError(employeeError.message);
      return;
    }

    const employeeIds = (employeeRows ?? []).map((e) => e.id);
    if (employeeIds.length === 0) {
      setSettings([]);
      return;
    }

    const { data, error } = await supabase
      .from("employee_payroll_settings")
      .select("*")
      .in("employee_id", employeeIds);

    if (error) {
      setError(error.message);
      return;
    }

    setSettings((data ?? []) as PayrollSettingsRow[]);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError(null);

      await Promise.all([loadEmployees(), loadClockLogs(), loadSchedules(), loadPayrollSettings()]);

      if (!cancelled) setLoading(false);
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function applyWeekPreset() {
    const weekStart = startOfWeekSunday();
    const weekEnd = addDays(weekStart, 6);
    setPeriodPreset("week");
    setDateFrom(toDateInputValue(weekStart));
    setDateTo(toDateInputValue(weekEnd));
  }

  function applyBiweeklyPreset() {
    const weekStart = startOfWeekSunday();
    const biweeklyEnd = addDays(weekStart, 13);
    setPeriodPreset("biweekly");
    setDateFrom(toDateInputValue(weekStart));
    setDateTo(toDateInputValue(biweeklyEnd));
  }

  function openEdit(employeeId: string) {
    const existing = settings.find((s) => s.employee_id === employeeId);

    setEditingEmployeeId(employeeId);
    setFormValues({
      federal_tax_percent: String(existing?.federal_tax_percent ?? defaultSettings.federal_tax_percent),
      social_security_percent: String(
        existing?.social_security_percent ?? defaultSettings.social_security_percent
      ),
      medicare_percent: String(existing?.medicare_percent ?? defaultSettings.medicare_percent),
      state_tax_percent: String(existing?.state_tax_percent ?? defaultSettings.state_tax_percent),
      insurance_amount: String(existing?.insurance_amount ?? defaultSettings.insurance_amount),
      dental_amount: String(existing?.dental_amount ?? defaultSettings.dental_amount),
      other_deductions: String(existing?.other_deductions ?? defaultSettings.other_deductions),
    });
  }

  function closeEdit() {
    setEditingEmployeeId(null);
    setFormValues({
      federal_tax_percent: "",
      social_security_percent: "",
      medicare_percent: "",
      state_tax_percent: "",
      insurance_amount: "",
      dental_amount: "",
      other_deductions: "",
    });
  }

  async function savePayrollSettings() {
    if (!editingEmployeeId) return;

    setSaving(true);
    setError(null);

    const payload = {
      employee_id: editingEmployeeId,
      federal_tax_percent: Number(formValues.federal_tax_percent || 0),
      social_security_percent: Number(formValues.social_security_percent || 0),
      medicare_percent: Number(formValues.medicare_percent || 0),
      state_tax_percent: Number(formValues.state_tax_percent || 0),
      insurance_amount: Number(formValues.insurance_amount || 0),
      dental_amount: Number(formValues.dental_amount || 0),
      other_deductions: Number(formValues.other_deductions || 0),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("employee_payroll_settings")
      .upsert(payload, { onConflict: "employee_id" });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    await loadPayrollSettings();

    setSaving(false);
    closeEdit();
  }

  const parsedMileageRate = Number(mileageRate || 0);

  const filteredClockLogs = useMemo(() => {
    if (!dateFrom || !dateTo) return clockLogs;

    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    const to = new Date(`${dateTo}T23:59:59`).getTime();

    return clockLogs.filter((log) => {
      if (!log.clock_in) return false;
      const time = new Date(log.clock_in).getTime();
      return time >= from && time <= to;
    });
  }, [clockLogs, dateFrom, dateTo]);

  const filteredSchedules = useMemo(() => {
    if (!dateFrom || !dateTo) return schedules;

    return schedules.filter((schedule) => {
      return schedule.work_date >= dateFrom && schedule.work_date <= dateTo;
    });
  }, [schedules, dateFrom, dateTo]);

  const payrollRows = useMemo(() => {
    return employees.map((employee) => {
      const employeeLogs = filteredClockLogs.filter(
        (log) => log.employee_id === employee.id && log.clock_in && log.clock_out
      );

      const totalHours = employeeLogs.reduce((sum, log) => {
        if (!log.clock_in || !log.clock_out) return sum;

        const start = new Date(log.clock_in).getTime();
        const end = new Date(log.clock_out).getTime();

        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;

        return sum + (end - start) / (1000 * 60 * 60);
      }, 0);

      const employeeSchedules = filteredSchedules.filter((schedule) => schedule.employee_id === employee.id);

      const mileageUnits = employeeSchedules.reduce((sum, schedule) => {
        return sum + (schedule.mileage ?? 0);
      }, 0);

      const mileageReimbursement = mileageUnits * (Number.isNaN(parsedMileageRate) ? 0 : parsedMileageRate);

      const employeeSettings =
        settings.find((s) => s.employee_id === employee.id) ??
        ({
          id: "",
          employee_id: employee.id,
          ...defaultSettings,
        } as PayrollSettingsRow);

      const hourlyRate = employee.hourly_rate ?? 0;
      const grossPay = totalHours * hourlyRate;
      const grossWithReimbursement = grossPay + mileageReimbursement;

      const federalTax = grossPay * (employeeSettings.federal_tax_percent / 100);
      const socialSecurity = grossPay * (employeeSettings.social_security_percent / 100);
      const medicare = grossPay * (employeeSettings.medicare_percent / 100);
      const stateTax = grossPay * (employeeSettings.state_tax_percent / 100);

      const fixedDeductions =
        (employeeSettings.insurance_amount ?? 0) +
        (employeeSettings.dental_amount ?? 0) +
        (employeeSettings.other_deductions ?? 0);

      const totalDeductions = federalTax + socialSecurity + medicare + stateTax + fixedDeductions;

      const netPay = grossWithReimbursement - totalDeductions;

      return {
        employee,
        settings: employeeSettings,
        totalHours,
        mileageUnits,
        mileageRate: Number.isNaN(parsedMileageRate) ? 0 : parsedMileageRate,
        mileageReimbursement,
        grossPay,
        grossWithReimbursement,
        federalTax,
        socialSecurity,
        medicare,
        stateTax,
        fixedDeductions,
        totalDeductions,
        netPay,
      };
    });
  }, [employees, filteredClockLogs, filteredSchedules, settings, parsedMileageRate]);

  const totalHoursAll = payrollRows.reduce((sum, row) => sum + row.totalHours, 0);
  const totalGross = payrollRows.reduce((sum, row) => sum + row.grossWithReimbursement, 0);
  const totalNet = payrollRows.reduce((sum, row) => sum + row.netPay, 0);
  const totalDeductionsAll = payrollRows.reduce((sum, row) => sum + row.totalDeductions, 0);

  function exportSummaryPdf() {
    try {
      setExportingPdf(true);

      const doc = new jsPDF("p", "mm", "a4");

      doc.setFontSize(18);
      doc.text("Payroll Summary", 14, 18);

      doc.setFontSize(10);
      doc.text(`Period: ${formatAppDate(dateFrom)} - ${formatAppDate(dateTo)}`, 14, 26);
      doc.text(`Mileage Rate: ${formatCurrency(safeNumber(parsedMileageRate))}/mile`, 14, 32);
      doc.text(`Employees: ${employees.length}`, 14, 38);
      doc.text(`Gross Payroll: ${formatCurrency(totalGross)}`, 110, 26);
      doc.text(`Total Deductions: ${formatCurrency(totalDeductionsAll)}`, 110, 32);
      doc.text(`Estimated Net Payroll: ${formatCurrency(totalNet)}`, 110, 38);

      autoTable(doc, {
        startY: 46,
        head: [["Employee", "Hours", "Rate", "Gross", "Mileage", "Deductions", "Net"]],
        body: payrollRows.map((row) => [
          row.employee.name,
          row.totalHours.toFixed(2),
          formatCurrency(row.employee.hourly_rate ?? 0),
          formatCurrency(row.grossPay),
          formatCurrency(row.mileageReimbursement),
          formatCurrency(row.totalDeductions),
          formatCurrency(row.netPay),
        ]),
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [17, 24, 39],
        },
      });

      const fileName = `payroll-summary-${dateFrom}-to-${dateTo}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error(err);
      setError("Failed to export payroll summary PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  function exportEmployeePdf(row: PayrollRow) {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      doc.setFontSize(18);
      doc.text("Employee Pay Statement", 14, 18);

      doc.setFontSize(10);
      doc.text(`Employee: ${row.employee.name}`, 14, 28);
      doc.text(`Email: ${row.employee.email}`, 14, 34);
      doc.text(`Pay Period: ${formatAppDate(dateFrom)} - ${formatAppDate(dateTo)}`, 14, 40);

      autoTable(doc, {
        startY: 48,
        theme: "grid",
        head: [["Earnings", "Amount"]],
        body: [
          ["Total Hours", row.totalHours.toFixed(2)],
          ["Hourly Rate", formatCurrency(row.employee.hourly_rate ?? 0)],
          ["Gross Pay", formatCurrency(row.grossPay)],
          ["Mileage Units", row.mileageUnits.toFixed(2)],
          ["Mileage Rate", `${formatCurrency(row.mileageRate)}/mile`],
          ["Mileage Reimbursement", formatCurrency(row.mileageReimbursement)],
          ["Total Earnings", formatCurrency(row.grossWithReimbursement)],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [17, 24, 39] },
      });

      const finalY1 = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 48;

      autoTable(doc, {
        startY: finalY1 + 8,
        theme: "grid",
        head: [["Withholdings / Deductions", "Amount"]],
        body: [
          ["Federal Tax", `-${formatCurrency(row.federalTax)}`],
          ["Social Security", `-${formatCurrency(row.socialSecurity)}`],
          ["Medicare", `-${formatCurrency(row.medicare)}`],
          ["State Tax", `-${formatCurrency(row.stateTax)}`],
          ["Insurance", `-${formatCurrency(row.settings.insurance_amount ?? 0)}`],
          ["Dental", `-${formatCurrency(row.settings.dental_amount ?? 0)}`],
          ["Other Deductions", `-${formatCurrency(row.settings.other_deductions ?? 0)}`],
          ["Total Deductions", `-${formatCurrency(row.totalDeductions)}`],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [17, 24, 39] },
      });

      const finalY2 =
        (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? finalY1 + 8;

      doc.setFontSize(14);
      doc.text(`Estimated Net Pay: ${formatCurrency(row.netPay)}`, 14, finalY2 + 14);

      const safeEmployeeName = row.employee.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const fileName = `${safeEmployeeName || "employee"}-payroll-${dateFrom}-to-${dateTo}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error(err);
      setError(`Failed to export PDF for ${row.employee.name}.`);
    }
  }

  const editingRow = payrollRows.find((r) => r.employee.id === editingEmployeeId) ?? null;

  const liveFederal = editingRow ? editingRow.grossPay * (Number(formValues.federal_tax_percent || 0) / 100) : 0;
  const liveSocialSecurity = editingRow
    ? editingRow.grossPay * (Number(formValues.social_security_percent || 0) / 100)
    : 0;
  const liveMedicare = editingRow ? editingRow.grossPay * (Number(formValues.medicare_percent || 0) / 100) : 0;
  const liveStateTax = editingRow ? editingRow.grossPay * (Number(formValues.state_tax_percent || 0) / 100) : 0;
  const liveFixedDeductions =
    Number(formValues.insurance_amount || 0) +
    Number(formValues.dental_amount || 0) +
    Number(formValues.other_deductions || 0);
  const liveTotalDeductions = liveFederal + liveSocialSecurity + liveMedicare + liveStateTax + liveFixedDeductions;
  const liveNetPay = editingRow ? editingRow.grossWithReimbursement - liveTotalDeductions : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading Payroll..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: tokens.spacing[7] }}>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
          Payroll
        </h1>
        <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
          Estimated payroll summary with taxes, deductions, mileage reimbursement, and date-range filtering.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: tokens.spacing[5],
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

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Payroll Period</SectionHeader>
        <Panel padding="md">
          <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap", marginBottom: tokens.spacing[4] }}>
            <button
              type="button"
              onClick={applyWeekPreset}
              className="cc-btn"
              style={{ ...presetButtonStyle, ...(periodPreset === "week" ? presetActiveStyle : {}) }}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={applyBiweeklyPreset}
              className="cc-btn"
              style={{ ...presetButtonStyle, ...(periodPreset === "biweekly" ? presetActiveStyle : {}) }}
            >
              Biweekly
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset("custom")}
              className="cc-btn"
              style={{ ...presetButtonStyle, ...(periodPreset === "custom" ? presetActiveStyle : {}) }}
            >
              Custom
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacing[3] }}>
            <FormField label="Date From">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setPeriodPreset("custom");
                  setDateFrom(e.target.value);
                }}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Date To">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setPeriodPreset("custom");
                  setDateTo(e.target.value);
                }}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Mileage Rate ($ / mile)">
              <input
                type="number"
                step="0.01"
                value={mileageRate}
                onChange={(e) => setMileageRate(e.target.value)}
                style={inputStyle}
              />
            </FormField>
          </div>

          <div style={{ marginTop: tokens.spacing[3], fontSize: tokens.typography.size.sm, color: tokens.paper.inkMuted }}>
            Period: {formatAppDate(dateFrom)} — {formatAppDate(dateTo)}
          </div>
        </Panel>
      </section>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader
          action={
            <button
              type="button"
              onClick={exportSummaryPdf}
              disabled={exportingPdf || payrollRows.length === 0}
              className="cc-btn"
              style={{
                minHeight: 36,
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                borderRadius: tokens.radius.structural,
                border: "none",
                background: tokens.signal.base,
                color: "#1a1305",
                fontSize: tokens.typography.size.sm,
                fontWeight: tokens.typography.weight.bold,
              }}
            >
              {exportingPdf ? "Exporting PDF..." : "Export Summary PDF"}
            </button>
          }
        >
          Summary
        </SectionHeader>
        <StatusBand
          items={[
            { label: "Employees", value: employees.length },
            { label: "Total Hours", value: totalHoursAll.toFixed(2) },
            { label: "Gross Payroll", value: formatCurrency(totalGross) },
            { label: "Estimated Net Payroll", value: formatCurrency(totalNet) },
          ]}
        />
      </section>

      <section>
        <SectionHeader>Employee Payroll Ledger</SectionHeader>
        {payrollRows.length === 0 ? (
          <EmptyState
            title="No payroll data found yet."
            style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
          />
        ) : (
          <div
            style={{
              overflowX: "auto",
              border: `1px solid ${tokens.paper.border}`,
              borderRadius: tokens.radius.structural,
              background: tokens.paper.surface,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th scope="col" style={thStyle}>Employee</th>
                  <th scope="col" style={thStyle}>Status</th>
                  <th scope="col" style={thStyle}>Hours</th>
                  <th scope="col" style={thStyle}>Hourly Rate</th>
                  <th scope="col" style={thStyle}>Gross Pay</th>
                  <th scope="col" style={thStyle}>Estimated Net Pay</th>
                  <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                    <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payrollRows.map((row) => (
                  <tr key={row.employee.id}>
                    <td style={{ ...tdStyle, fontWeight: tokens.typography.weight.semibold }}>{row.employee.name}</td>
                    <td style={tdStyle}>
                      <StatusDot active={row.employee.is_active} label={row.employee.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>{row.totalHours.toFixed(2)}</td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {formatCurrency(row.employee.hourly_rate ?? 0)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>{formatCurrency(row.grossPay)}</td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono, fontWeight: tokens.typography.weight.bold }}>
                      {formatCurrency(row.netPay)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => openEdit(row.employee.id)} className="cc-btn" style={rowButtonStyle}>
                          Review
                        </button>
                        <button type="button" onClick={() => exportEmployeePdf(row)} className="cc-btn" style={rowButtonStyle}>
                          Export PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingRow && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ marginBottom: tokens.spacing[5] }}>
              <h2 style={{ margin: "0 0 4px", fontSize: tokens.typography.size.xl, fontWeight: tokens.typography.weight.bold }}>
                {editingRow.employee.name}
              </h2>
              <p style={{ margin: 0, fontSize: tokens.typography.size.sm, color: tokens.paper.inkMuted }}>
                {editingRow.employee.email} · {formatAppDate(dateFrom)} — {formatAppDate(dateTo)}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacing[3], marginBottom: tokens.spacing[5] }}>
              <BreakdownBlock
                title="Earnings"
                lines={[
                  ["Hours", editingRow.totalHours.toFixed(2)],
                  ["Hourly Rate", formatCurrency(editingRow.employee.hourly_rate ?? 0)],
                  ["Gross Pay", formatCurrency(editingRow.grossPay)],
                  ["Mileage", formatCurrency(editingRow.mileageReimbursement)],
                  ["Gross + Reimbursement", formatCurrency(editingRow.grossWithReimbursement)],
                ]}
              />
              <BreakdownBlock
                title="Withholdings"
                lines={[
                  ["Federal", `-${formatCurrency(liveFederal)}`],
                  ["Social Security", `-${formatCurrency(liveSocialSecurity)}`],
                  ["Medicare", `-${formatCurrency(liveMedicare)}`],
                  ["State", `-${formatCurrency(liveStateTax)}`],
                ]}
              />
              <BreakdownBlock
                title="Deductions"
                lines={[
                  ["Insurance", `-${formatCurrency(Number(formValues.insurance_amount || 0))}`],
                  ["Dental", `-${formatCurrency(Number(formValues.dental_amount || 0))}`],
                  ["Other", `-${formatCurrency(Number(formValues.other_deductions || 0))}`],
                ]}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                marginBottom: tokens.spacing[5],
                borderRadius: tokens.radius.structural,
                background: tokens.paper.surface2,
                fontSize: tokens.typography.size.lg,
                fontWeight: tokens.typography.weight.bold,
              }}
            >
              <span>Estimated Net Pay</span>
              <span>{formatCurrency(liveNetPay)}</span>
            </div>

            <SectionHeader>Edit Deductions</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacing[3], marginBottom: tokens.spacing[5] }}>
              <FormField label="Federal Tax %">
                <input
                  value={formValues.federal_tax_percent}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, federal_tax_percent: e.target.value }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Social Security %">
                <input
                  value={formValues.social_security_percent}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, social_security_percent: e.target.value }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Medicare %">
                <input
                  value={formValues.medicare_percent}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, medicare_percent: e.target.value }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="State Tax %">
                <input
                  value={formValues.state_tax_percent}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, state_tax_percent: e.target.value }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Insurance $">
                <input
                  value={formValues.insurance_amount}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, insurance_amount: e.target.value }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Dental $">
                <input
                  value={formValues.dental_amount}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, dental_amount: e.target.value }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Other Deductions $">
                <input
                  value={formValues.other_deductions}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, other_deductions: e.target.value }))}
                  style={inputStyle}
                />
              </FormField>
            </div>

            <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={savePayrollSettings}
                disabled={saving}
                className="cc-btn"
                style={{ ...actionButtonStyle, background: tokens.signal.base, color: "#1a1305", border: "none" }}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="cc-btn"
                style={{ ...actionButtonStyle, background: "transparent", color: tokens.paper.inkMuted, border: `1px solid ${tokens.paper.border}` }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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

function BreakdownBlock({ title, lines }: { title: string; lines: [string, string][] }) {
  return (
    <Panel padding="sm">
      <div
        style={{
          fontFamily: tokens.fontFamilyOpsDeck.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: tokens.paper.inkMuted,
          marginBottom: tokens.spacing[2],
        }}
      >
        {title}
      </div>
      {lines.map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: tokens.spacing[2], fontSize: tokens.typography.size.sm, marginBottom: 4 }}>
          <span style={{ color: tokens.paper.inkMuted }}>{label}</span>
          <strong style={{ fontFamily: tokens.fontFamilyOpsDeck.mono }}>{value}</strong>
        </div>
      ))}
    </Panel>
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

const presetButtonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
  borderRadius: tokens.radius.structural,
  border: `1px solid ${tokens.paper.border}`,
  background: tokens.paper.surface,
  color: tokens.paper.inkMuted,
  fontSize: tokens.typography.size.sm,
  fontWeight: tokens.typography.weight.regular,
};

const presetActiveStyle: React.CSSProperties = {
  border: `1px solid ${tokens.signal.base}`,
  background: tokens.signal.softPaper,
  color: tokens.signal.strong,
  fontWeight: tokens.typography.weight.bold,
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

const rowButtonStyle: React.CSSProperties = {
  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
  minHeight: 36,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: tokens.radius.structural,
  border: `1px solid ${tokens.paper.borderStrong}`,
  fontSize: tokens.typography.size.sm,
  fontWeight: tokens.typography.weight.semibold,
  color: tokens.paper.ink,
  background: "transparent",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: `1px solid ${tokens.paper.borderStrong}`,
  fontFamily: tokens.fontFamilyOpsDeck.mono,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: tokens.paper.inkMuted,
};

const tdStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: `1px solid ${tokens.paper.border}`,
  fontSize: tokens.typography.size.sm,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "90vh",
  overflowY: "auto",
  background: tokens.paper.surface,
  borderRadius: tokens.radius.overlay,
  padding: tokens.spacing[6],
  boxShadow: tokens.shadow.lg,
};
