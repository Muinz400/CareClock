import { Panel } from "../../../components/ui/Panel";
import { tokens } from "../../../styles/tokens";

/*
  Shell-preview placeholder only — proves AdminShell renders correctly.
  No real data, no Supabase queries. Real content (priority queue, live
  status) lands in a later migration step.
*/
export default function AdminHomePage() {
  return (
    <div>
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <span
          style={{
            display: "inline-block",
            fontFamily: tokens.fontFamilyOpsDeck.mono,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tokens.signal.strong,
            background: tokens.signal.softPaper,
            padding: "4px 10px",
            borderRadius: tokens.radius.structural,
            marginBottom: tokens.spacing[3],
          }}
        >
          Migration Preview — Not Final Content
        </span>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], margin: 0, fontWeight: tokens.typography.weight.bold }}>
          Admin Home
        </h1>
      </div>

      <Panel>
        <p style={{ margin: 0, fontSize: tokens.typography.size.md, lineHeight: 1.6 }}>
          This page confirms the Operations Deck admin shell — sidebar, top bar,
          responsive collapse — is wired up correctly.
        </p>
        <p style={{ margin: `${tokens.spacing[3]} 0 0`, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
          Real content (priority queue, live status, operational data) is introduced
          in a later migration step — nothing here is production data.
        </p>
      </Panel>
    </div>
  );
}
