import type { PropsWithChildren } from "react";

interface AppShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <main className="app-shell">
      <header className="hero">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <section className="content">{children}</section>
    </main>
  );
}
