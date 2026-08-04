import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { tokens } from "../styles/tokens";

export const metadata: Metadata = {
title: "CareClock",
description: "A simple GPS-Verified timesheet for home care agencies",
};

type RootLayoutProps = {
children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
return (
<html lang="en">
<body>
<div style={{ minHeight: "100vh", background: tokens.colors.surfaceMuted }}>
<header
style={{
borderBottom: `1px solid ${tokens.colors.border}`,
background: tokens.colors.surface,
padding: `${tokens.spacing[4]} ${tokens.spacing[5]}`,
}}
>
<div
style={{
maxWidth: tokens.container.app,
margin: "0 auto",
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: tokens.spacing[4],
flexWrap: "wrap",
}}
>
<Link
href="/"
style={{
fontSize: 22,
fontWeight: tokens.typography.weight.bold,
textDecoration: "none",
color: tokens.colors.ink,
}}
>
CareClock
</Link>

<nav
style={{
display: "flex",
gap: tokens.spacing[3],
flexWrap: "wrap",
}}
>
<Link href="/admin" style={navLinkStyle}>
Admin
</Link>

<Link href="/employee" style={navLinkStyle}>
Employee
</Link>
</nav>
</div>
</header>

{/*
  This was previously a <main> element, which duplicated the <main>
  landmark every page already renders for itself — two <main> elements
  per page is invalid document structure. Each page's own <main> is now
  the single legitimate landmark.
*/}
<div style={{ maxWidth: tokens.container.app, margin: "0 auto", padding: tokens.spacing[5] }}>
{children}
</div>
</div>
</body>
</html>
);
}

const navLinkStyle: React.CSSProperties = {
background: tokens.colors.ink,
color: "#ffffff",
padding: "10px 14px",
borderRadius: tokens.radius.md,
textDecoration: "none",
fontWeight: tokens.typography.weight.semibold,
};
