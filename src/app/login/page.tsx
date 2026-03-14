"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

export default function LoginPage() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);

async function handleLogin(e: React.FormEvent) {
e.preventDefault();
setLoading(true);

const { error: signInError } = await supabase.auth.signInWithPassword({
email,
password,
});

if (signInError) {
alert(signInError.message);
setLoading(false);
return;
}

const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
alert("User not found after login.");
setLoading(false);
return;
}

const { data: profile, error: profileError } = await supabase
.from("profiles")
.select("id, role, full_name")
.eq("id", user.id)
.maybeSingle();

console.log("AUTH USER:", user);
console.log("PROFILE RESULT:", profile);
console.log("PROFILE ERROR:", profileError);

if (profileError) {
alert(`Profile query error: ${profileError.message}`);
setLoading(false);
return;
}

if (!profile) {
alert("Profile not found.");
setLoading(false);
return;
}

if (profile.role === "admin") {
router.push("/admin");
} else {
router.push("/employee/clock");
}
}

return (
<main
style={{
maxWidth: 400,
margin: "100px auto",
padding: 30,
border: "1px solid #e5e7eb",
borderRadius: 12,
background: "white",
}}
>
<h1 style={{ marginBottom: 20 }}>Login</h1>

<form
onSubmit={handleLogin}
style={{ display: "flex", flexDirection: "column", gap: 12 }}
>
<input
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
style={{ padding: 12, border: "1px solid #d1d5db", borderRadius: 8 }}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
style={{ padding: 12, border: "1px solid #d1d5db", borderRadius: 8 }}
/>

<button
type="submit"
disabled={loading}
style={{
padding: 12,
background: "#16a34a",
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


