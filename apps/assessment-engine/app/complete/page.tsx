import Link from "next/link";
import { env } from "../../lib/env";

export const dynamic = "force-dynamic";

export default function CompletePage() {
  return (
    <div className="assessment-container">
      <div className="assessment-complete">
        <h2 style={{ marginTop: '2rem' }}>Assessment Submitted</h2>
        <p>Your responses have been successfully submitted for evaluation.</p>
        <Link href={env.CANDIDATE_PORTAL_URL} className="btn btn--primary">
          Return to Portal
        </Link>
      </div>
    </div>
  );
}
