import { CaregiverShell } from "../../components/shell/CaregiverShell";

export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
  return <CaregiverShell>{children}</CaregiverShell>;
}
