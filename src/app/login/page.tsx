"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

export default function LoginPage() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);

async function handleLogin(e: FormEvent) {
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
router.push("/admin");
} else {
router.push("/employee/clock");
}
} catch (error) {
console.error(error);
alert("Something went wrong during login.");
} finally {
setLoading(false);
}
}

return (
<main
style={{
maxWidth: 420,
margin: "100px auto",
padding: 32,
border: "1px solid #e5e7eb",
borderRadius: 12,
background: "white",
}}
>
<h1 style={{ marginBottom: 20 }}>Login</h1>

<form onSubmit={handleLogin}>
<input
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
style={{
width: "100%",
padding: "12px",
marginBottom: 12,
border: "1px solid #d1d5db",
borderRadius: 8,
}}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
style={{
width: "100%",
padding: "12px",
marginBottom: 16,
border: "1px solid #d1d5db",
borderRadius: 8,
}}
/>

<button
type="submit"
disabled={loading}
style={{
width: "100%",
padding: "12px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
}}
>
{loading ? "Logging in..." : "Login"}
</button>
</form>
</main>
);
}
