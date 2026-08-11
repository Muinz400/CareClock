import Link from "next/link";
import { tokens } from "../../styles/tokens";

/*
  Public marketing landing page. Server-rendered — the only interactive
  element (Book a Demo) uses a native <details>/<summary> disclosure, not
  client-side JavaScript. The <style> block below only hides the default
  disclosure marker and rotates a custom chevron; both need real CSS
  selectors ([open], ::-webkit-details-marker) that can't be expressed as
  inline styles, so they live here, scoped to this file, rather than in
  globals.css.

  Marketing copy is deliberately conservative: "location-aware clock-in",
  not "GPS-verified" — the production geofence is still a single hardcoded
  job site, not per-house geofencing, so the stronger claim isn't accurate
  yet. No testimonials, logos, usage numbers, or invented integrations.
*/

const MARKETING_MAX_WIDTH = 1120;

const CAPABILITIES = [
  { label: "Scheduling", copy: "Build and manage shift schedules across houses and teams from one place." },
  { label: "Mobile, location-aware clock in/out", copy: "Caregivers clock in and out from their phone, with location-aware verification." },
  { label: "Timesheets", copy: "Time worked is organized automatically from clock activity, ready for review." },
  { label: "Mileage", copy: "Log mileage alongside shifts for accurate reimbursement records." },
  { label: "Payroll preparation", copy: "Turn worked hours and mileage into payroll-ready records." },
  { label: "House / location management", copy: "Keep houses, locations, and assignments organized in one system." },
  { label: "Workforce visibility", copy: "See who's scheduled, who's working, and where — at a glance." },
];

const WHO_ITS_FOR = [
  "Supported living agencies",
  "Group homes",
  "Adult family homes",
  "Home care organizations",
];

const BENEFITS = [
  "Less fragmented administration",
  "Easier scheduling",
  "Clearer time records",
  "Simpler payroll preparation",
  "Easier day-to-day caregiver experience",
];

const DEMO_MESSAGE =
  "Demo booking isn't available yet — we're preparing early CareClock demos now. Check back soon.";

function Eyebrow({ children, tone = "paper" }: { children: React.ReactNode; tone?: "paper" | "shell" }) {
  return (
    <div
      style={{
        fontFamily: tokens.fontFamilyOpsDeck.mono,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: tone === "shell" ? tokens.signal.base : tokens.signal.strong,
        marginBottom: tokens.spacing[3],
      }}
    >
      {children}
    </div>
  );
}

function BookDemoDisclosure({ tone = "paper" }: { tone?: "paper" | "shell" }) {
  const isShell = tone === "shell";
  return (
    <details className="cc-demo-disclosure">
      <summary
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 22px",
          minHeight: 44,
          background: tokens.signal.base,
          color: "#1a1305",
          borderRadius: tokens.radius.action,
          fontWeight: tokens.typography.weight.semibold,
          fontSize: tokens.typography.size.base,
        }}
      >
        Book a Demo
        <span className="cc-demo-chevron" aria-hidden="true">
          ▾
        </span>
      </summary>
      <p
        style={{
          marginTop: tokens.spacing[3],
          maxWidth: 360,
          fontSize: tokens.typography.size.sm,
          lineHeight: 1.6,
          color: isShell ? tokens.shell.inkMuted : tokens.paper.inkMuted,
        }}
      >
        {DEMO_MESSAGE}
      </p>
    </details>
  );
}

function SignInLink({ tone = "paper" }: { tone?: "paper" | "shell" }) {
  const isShell = tone === "shell";
  return (
    <Link
      href="/login"
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 44,
        padding: "12px 22px",
        borderRadius: tokens.radius.action,
        border: `1px solid ${isShell ? tokens.shell.border : tokens.paper.borderStrong}`,
        color: isShell ? tokens.shell.ink : tokens.paper.ink,
        fontWeight: tokens.typography.weight.semibold,
        fontSize: tokens.typography.size.base,
      }}
    >
      Sign In
    </Link>
  );
}

function ProductComposition() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacing[4],
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 240,
          height: 160,
          display: "flex",
          border: `1px solid ${tokens.paper.border}`,
          borderRadius: tokens.radius.structural,
          background: tokens.paper.surface,
          overflow: "hidden",
        }}
      >
        <div style={{ width: 28, background: tokens.shell.bg, flex: "none" }} />
        <div style={{ flex: 1, padding: tokens.spacing[3], display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
          <div style={{ height: 8, width: "70%", borderRadius: 4, background: tokens.paper.border }} />
          <div style={{ height: 8, width: "90%", borderRadius: 4, background: tokens.paper.border }} />
          <div style={{ height: 8, width: "50%", borderRadius: 4, background: tokens.signal.softPaper }} />
          <div
            style={{
              marginTop: 10,
              fontFamily: tokens.fontFamilyOpsDeck.mono,
              fontSize: 9.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: tokens.paper.inkFaint,
            }}
          >
            Admin
          </div>
        </div>
      </div>

      <div
        style={{
          width: 160,
          height: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing[3],
          border: `1px solid ${tokens.shell.border}`,
          borderRadius: tokens.radius.structural,
          background: tokens.shell.bg,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: `2px solid ${tokens.signal.base}`,
          }}
        />
        <div style={{ width: "60%", height: 6, borderRadius: 3, background: tokens.shell.bg3 }} />
        <div
          style={{
            fontFamily: tokens.fontFamilyOpsDeck.mono,
            fontSize: 9.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tokens.shell.inkFaint,
          }}
        >
          Caregiver
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: tokens.paper.bg, color: tokens.paper.ink, fontFamily: tokens.fontFamilyOpsDeck.sans }}>
      <style>{`
        .cc-demo-disclosure summary { cursor: pointer; list-style: none; }
        .cc-demo-disclosure summary::-webkit-details-marker { display: none; }
        .cc-demo-disclosure .cc-demo-chevron { transition: transform 150ms ease; display: inline-block; }
        .cc-demo-disclosure[open] .cc-demo-chevron { transform: rotate(180deg); }
      `}</style>

      {/* ---- Public header ---- */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: tokens.paper.surface,
          borderBottom: `1px solid ${tokens.paper.border}`,
        }}
      >
        <div
          style={{
            maxWidth: MARKETING_MAX_WIDTH,
            margin: "0 auto",
            padding: `${tokens.spacing[3]} ${tokens.spacing[5]}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: tokens.spacing[3],
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: tokens.typography.weight.bold,
              fontSize: tokens.typography.size.md,
              color: tokens.paper.ink,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                borderRadius: tokens.radius.structural,
                background: tokens.signal.base,
                color: "#1a1305",
                fontWeight: 800,
                fontSize: 11,
                fontFamily: tokens.fontFamilyOpsDeck.mono,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              C
            </span>
            CareClock
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing[3] }}>
            <a
              href="#book-a-demo"
              className="cc-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 40,
                padding: "9px 18px",
                borderRadius: tokens.radius.action,
                background: tokens.signal.base,
                color: "#1a1305",
                fontWeight: tokens.typography.weight.semibold,
                fontSize: tokens.typography.size.sm,
                textDecoration: "none",
              }}
            >
              Book a Demo
            </a>
            <Link
              href="/login"
              style={{
                fontWeight: tokens.typography.weight.semibold,
                fontSize: tokens.typography.size.sm,
                color: tokens.paper.ink,
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section
        id="book-a-demo"
        style={{
          maxWidth: MARKETING_MAX_WIDTH,
          margin: "0 auto",
          padding: `${tokens.spacing[10]} ${tokens.spacing[5]} ${tokens.spacing[9]}`,
          textAlign: "center",
        }}
      >
        <Eyebrow>For caregiving agencies</Eyebrow>

        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            lineHeight: 1.15,
            fontWeight: tokens.typography.weight.bold,
            letterSpacing: "-0.02em",
            maxWidth: 780,
            margin: `0 auto ${tokens.spacing[4]}`,
          }}
        >
          Scheduling, time tracking, and payroll prep — built for caregiving agencies.
        </h1>

        <p
          style={{
            maxWidth: 620,
            margin: `0 auto ${tokens.spacing[7]}`,
            fontSize: tokens.typography.size.lg,
            lineHeight: 1.6,
            color: tokens.paper.inkMuted,
          }}
        >
          CareClock brings scheduling, location-aware clock-in, timesheets, mileage, and payroll
          preparation into one system designed around how care teams actually work.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: tokens.spacing[3],
            justifyContent: "center",
            marginBottom: tokens.spacing[9],
          }}
        >
          <BookDemoDisclosure />
          <SignInLink />
        </div>

        <ProductComposition />
      </section>

      {/* ---- Core Capabilities ---- */}
      <section style={{ maxWidth: MARKETING_MAX_WIDTH, margin: "0 auto", padding: `${tokens.spacing[9]} ${tokens.spacing[5]}` }}>
        <Eyebrow>Core capabilities</Eyebrow>
        <h2 style={{ fontSize: tokens.typography.size["3xl"], margin: `0 0 ${tokens.spacing[7]}`, maxWidth: 560 }}>
          Everything a caregiving agency&rsquo;s day-to-day operations run on.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: `${tokens.spacing[6]} ${tokens.spacing[6]}`,
          }}
        >
          {CAPABILITIES.map((item) => (
            <div key={item.label} style={{ borderLeft: `2px solid ${tokens.signal.base}`, paddingLeft: tokens.spacing[3] }}>
              <div style={{ fontWeight: tokens.typography.weight.semibold, marginBottom: 4 }}>{item.label}</div>
              <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm, lineHeight: 1.55 }}>
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Product Experience ---- */}
      <section style={{ maxWidth: MARKETING_MAX_WIDTH, margin: "0 auto", padding: `${tokens.spacing[9]} ${tokens.spacing[5]}` }}>
        <Eyebrow>Product experience</Eyebrow>
        <h2 style={{ fontSize: tokens.typography.size["3xl"], margin: `0 0 ${tokens.spacing[2]}` }}>
          One system. Two purpose-built experiences.
        </h2>
        <p style={{ margin: `0 0 ${tokens.spacing[7]}`, color: tokens.paper.inkMuted, maxWidth: 620 }}>
          CareClock is built as two focused experiences on the same underlying system — one for
          running the organization, one for the day-to-day of a shift.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: tokens.spacing[5] }}>
          <div
            style={{
              padding: tokens.spacing[6],
              borderRadius: tokens.radius.structural,
              border: `1px solid ${tokens.paper.border}`,
              background: tokens.paper.surface,
            }}
          >
            <div
              style={{
                fontFamily: tokens.fontFamilyOpsDeck.mono,
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: tokens.signal.strong,
                marginBottom: tokens.spacing[2],
              }}
            >
              Admin / Owner
            </div>
            <p style={{ margin: `0 0 ${tokens.spacing[4]}`, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
              An operational workspace for running the organization.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {["Scheduling", "Workforce visibility", "Time management", "Payroll preparation"].map((item) => (
                <li key={item} style={{ fontSize: tokens.typography.size.sm }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              padding: tokens.spacing[6],
              borderRadius: tokens.radius.structural,
              border: `1px solid ${tokens.shell.border}`,
              background: tokens.shell.bg,
              color: tokens.shell.ink,
            }}
          >
            <div
              style={{
                fontFamily: tokens.fontFamilyOpsDeck.mono,
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: tokens.signal.base,
                marginBottom: tokens.spacing[2],
              }}
            >
              Caregiver
            </div>
            <p style={{ margin: `0 0 ${tokens.spacing[4]}`, color: tokens.shell.inkMuted, fontSize: tokens.typography.size.sm }}>
              A simple, mobile-first way to manage the workday.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {["Clock in/out", "Shift context", "Mileage", "Timesheets"].map((item) => (
                <li key={item} style={{ fontSize: tokens.typography.size.sm }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Who It's For ---- */}
      <section style={{ maxWidth: MARKETING_MAX_WIDTH, margin: "0 auto", padding: `${tokens.spacing[9]} ${tokens.spacing[5]}` }}>
        <Eyebrow>Who it&rsquo;s for</Eyebrow>
        <h2 style={{ fontSize: tokens.typography.size["3xl"], margin: `0 0 ${tokens.spacing[6]}`, maxWidth: 560 }}>
          Built for care organizations like yours.
        </h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacing[3] }}>
          {WHO_ITS_FOR.map((item) => (
            <span
              key={item}
              style={{
                padding: "10px 18px",
                borderRadius: tokens.radius.full,
                background: tokens.paper.surface2,
                fontSize: tokens.typography.size.sm,
                fontWeight: tokens.typography.weight.medium,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ---- Benefits ---- */}
      <section style={{ maxWidth: MARKETING_MAX_WIDTH, margin: "0 auto", padding: `${tokens.spacing[9]} ${tokens.spacing[5]}` }}>
        <Eyebrow>Benefits</Eyebrow>
        <h2 style={{ fontSize: tokens.typography.size["3xl"], margin: `0 0 ${tokens.spacing[6]}`, maxWidth: 560 }}>
          What changes for your team.
        </h2>

        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: tokens.spacing[3], maxWidth: 520 }}>
          {BENEFITS.map((item) => (
            <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: tokens.typography.size.md }}>
              <span
                aria-hidden="true"
                style={{ width: 6, height: 6, borderRadius: "50%", background: tokens.signal.base, marginTop: 9, flex: "none" }}
              />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Closing CTA ---- */}
      <section
        style={{
          background: tokens.shell.bg,
          color: tokens.shell.ink,
          padding: `${tokens.spacing[9]} ${tokens.spacing[5]}`,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: tokens.typography.size["2xl"], margin: `0 0 ${tokens.spacing[2]}` }}>
          See CareClock for your agency.
        </h2>
        <p style={{ margin: `0 auto ${tokens.spacing[6]}`, maxWidth: 480, color: tokens.shell.inkMuted }}>
          Book a demo, or sign in if you already have a CareClock account.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacing[3], justifyContent: "center" }}>
          <BookDemoDisclosure tone="shell" />
          <SignInLink tone="shell" />
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer style={{ borderTop: `1px solid ${tokens.paper.border}` }}>
        <div
          style={{
            maxWidth: MARKETING_MAX_WIDTH,
            margin: "0 auto",
            padding: `${tokens.spacing[6]} ${tokens.spacing[5]}`,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: tokens.spacing[4],
          }}
        >
          <span style={{ fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.sm }}>
            CareClock
          </span>

          <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacing[5], fontSize: tokens.typography.size.sm }}>
            <span style={{ color: tokens.paper.inkFaint }}>Contact</span>
            <span style={{ color: tokens.paper.inkFaint }}>Privacy</span>
            <span style={{ color: tokens.paper.inkFaint }}>Terms</span>
            <Link href="/login" style={{ color: tokens.paper.ink, fontWeight: tokens.typography.weight.semibold }}>
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
