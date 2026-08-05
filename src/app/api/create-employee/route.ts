import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { name, email, hourlyRate, orgId } = body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Employee name is required." }, { status: 400 });
    }

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Employee email is required." }, { status: 400 });
    }

    if (typeof orgId !== "string" || !orgId.trim()) {
      return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
    }

    if (typeof hourlyRate !== "number" || !Number.isFinite(hourlyRate) || hourlyRate < 0) {
      return NextResponse.json(
        { error: "Hourly rate must be a valid non-negative number." },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json({ error: "Missing or invalid authorization." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appUrl = process.env.APP_URL;

    if (!supabaseUrl || !serviceRoleKey) {
      // TEMPORARY diagnostic aid: reports which variable names are unset so this
      // can be confirmed against Vercel's configuration without exposing values.
      // Remove once the deployment's missing variable(s) are confirmed resolved.
      const missing: string[] = [];
      if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
      if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

      return NextResponse.json(
        { error: "Missing server environment variables.", missing },
        { status: 500 }
      );
    }

    if (!appUrl || !isValidHttpUrl(appUrl)) {
      return NextResponse.json(
        { error: "Server is missing a valid application URL configuration." },
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
        { error: "Only administrators can create employees." },
        { status: 403 }
      );
    }

    if (callerProfile.org_id !== orgId) {
      return NextResponse.json(
        { error: "You are not authorized to add employees to this organization." },
        { status: 403 }
      );
    }

    const redirectTo = `${appUrl.replace(/\/$/, "")}/accept-invite`;

    const { data: inviteData, error: inviteError } =
      await adminSupabase.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: name,
          role: "employee",
        },
        redirectTo,
      });

    if (inviteError || !inviteData?.user) {
      return NextResponse.json(
        {
          error:
            "Failed to send employee invitation email. Confirm Supabase email delivery is configured.",
        },
        { status: 502 }
      );
    }

    const userId = inviteData.user.id;

    const { error: profileError } = await adminSupabase.from("profiles").insert({
      id: userId,
      org_id: orgId,
      full_name: name,
      role: "employee",
    });

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { error: employeeError } = await adminSupabase.from("employees").insert({
      org_id: orgId,
      user_id: userId,
      email,
      name,
      hourly_rate: hourlyRate,
    });

    if (employeeError) {
      await adminSupabase.from("profiles").delete().eq("id", userId);
      await adminSupabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: employeeError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, inviteSent: true });
  } catch {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
