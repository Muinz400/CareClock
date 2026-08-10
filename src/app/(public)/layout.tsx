import { tokens } from "../../styles/tokens";

/*
  Structural shell migration only — not a visual redesign of the public
  pages. The only intended visible change from before is the removal of
  the old global CareClock/Admin/Employee header; the surrounding
  background matches what that header's wrapper previously provided so
  page content doesn't shift.
*/
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: tokens.colors.surfaceMuted }}>
      {children}
    </div>
  );
}
