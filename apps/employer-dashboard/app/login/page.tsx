import type { Metadata } from "next";
import { LoginForm } from "../components/LoginForm";

export const metadata: Metadata = {
  title: "Sign In · Employer Dashboard",
  description: "Access your candidate evaluation pipeline.",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-page__brand">
        <div className="login-brand-mark" aria-hidden="true">Z</div>
        <h1 className="login-brand-name">Zetheta</h1>
        <p className="login-brand-tagline">Employer Admin Portal</p>
      </div>
      <LoginForm />
    </main>
  );
}
