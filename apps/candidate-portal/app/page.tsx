import type { Metadata } from "next";
import { LoginForm } from "./components/LoginForm";

export const metadata: Metadata = {
  title: "Sign In · Candidate Portal",
  description: "Sign in to access your Zetheta assessment portal.",
};

export default function HomePage() {
  return (
    <main className="login-page">
      <div className="login-page__brand">
        <div className="login-brand-mark" aria-hidden="true">Z</div>
        <h1 className="login-brand-name">Zetheta</h1>
        <p className="login-brand-tagline">Candidate Assessment Portal</p>
      </div>
      <LoginForm />
    </main>
  );
}
