import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
  Toggles an employee's employment status (employees.is_active). Mirrors
  create-employee/route.ts's exact security shape, since this is the same
  category of action: a privileged change to workforce access state that
  must never trust anything the browser sends beyond identity + intent.

  Never trusts a client-supplied org_id — the target employee's real
  org_id is always re-derived from the database and compared against the
  caller's own, server-resolved org_id. Only ever writes is_active; never
  deletes the auth user, profile, employee row, or any clock_logs/
  schedules/payroll-related record.
*/

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { employeeId, active } = body ?? {};

    if (typeof employeeId !== "string" || !employeeId.trim()) {
      return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
    }

    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "A valid active state is required." }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json({ error: "Missing or invalid authorization." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
      if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

      return NextResponse.json(
        { error: "Missing server environment variables.", missing },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: callerData,
      error: callerError,
    } = await adminSupabase.auth.getUser(token);

    if (callerError || !callerData?.user) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }

    const callerId = callerData.user.id;

    const { data: callerProfile, error: callerProfileError } = await adminSupabase
      .from("profiles")
      .select("role, org_id")
      .eq("id", callerId)
      .single();

    if (callerProfileError || !callerProfile) {
      return NextResponse.json({ error: "Unable to verify caller profile." }, { status: 403 });
    }

    if (callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can change employee status." },
        { status: 403 }
      );
    }

    const { data: targetEmployee, error: targetEmployeeError } = await adminSupabase
      .from("employees")
      .select("id, org_id")
      .eq("id", employeeId)
      .single();

    if (targetEmployeeError || !targetEmployee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    if (targetEmployee.org_id !== callerProfile.org_id) {
      return NextResponse.json(
        { error: "You are not authorized to modify this employee." },
        { status: 403 }
      );
    }

    const { error: updateError } = await adminSupabase
      .from("employees")
      .update({ is_active: active })
      .eq("id", employeeId)
      .eq("org_id", callerProfile.org_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, employeeId, active });
  } catch {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
