import { AppShell } from "@zetheta/ui";
import { AuthPanel } from "./components/AuthPanel";

export default function HomePage() {
  return (
    <AppShell
      title="Candidate Portal"
      subtitle="Secure assessment entry point for candidates."
    >
      <AuthPanel />
    </AppShell>
  );
}

