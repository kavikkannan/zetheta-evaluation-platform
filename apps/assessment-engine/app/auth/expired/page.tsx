import Link from "next/link";
import { env } from "../../../../lib/env";

export default function ExpiredPage() {
  return (
    <div className="assessment-container">
      <div className="hero" style={{ textAlign: "center" }}>
        <h1 style={{ color: "var(--color-error)" }}>Session Expired</h1>
        <p>Your assessment session has expired or is invalid.</p>
        <div style={{ marginTop: "2rem" }}>
          <Link href={env.CANDIDATE_PORTAL_URL} className="btn btn--primary">
            Return to Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
