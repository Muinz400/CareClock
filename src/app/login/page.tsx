"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

export default function LoginPage() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);

const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    });
    
    if (error) {
    alert(error.message);
    setLoading(false);
    return;
    }
    
    const {
    data: { user },
    error: userError,
    } = await supabase.auth.getUser();
    
    if (userError || !user) {
    alert("Login succeeded but user could not be loaded.");
    setLoading(false);
    return;
    }
    
    const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
    
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
    };
    
return (
<main
style={{
maxWidth: 400,
margin: "100px auto",
padding: 30,
border: "1px solid #e5e7eb",
borderRadius: 10,
background: "#fff",
}}
>
<h1>Login</h1>

<form
onSubmit={handleLogin}
style={{ display: "flex", flexDirection: "column", gap: 15 }}
>
<input
type="email"
placeholder="Email"
required
value={email}
onChange={(e) => setEmail(e.target.value)}
style={{ padding: 10 }}
/>

<input
type="password"
placeholder="Password"
required
value={password}
onChange={(e) => setPassword(e.target.value)}
style={{ padding: 10 }}
/>

<button
type="submit"
disabled={loading}
style={{
padding: 12,
background: "#16a34a",
color: "white",
border: "none",
borderRadius: 6,
cursor: "pointer",
}}
>
{loading ? "Logging in..." : "Login"}
</button>
</form>
</main>
);
}
