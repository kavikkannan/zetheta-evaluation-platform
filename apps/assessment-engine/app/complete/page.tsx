import Link from "next/link";
import { env } from "../../lib/env";

export default function CompletePage() {
  return (
    <div className="assessment-container">
      <div className="assessment-complete">
        <span className="assessment-complete-icon">🎉</span>
        <h2>Assessment Submitted</h2>
        <p>Your responses have been successfully submitted for evaluation.</p>
        <Link href={env.CANDIDATE_PORTAL_URL} className="btn btn--primary">
          Return to Portal
        </Link>
      </div>
    </div>
  );
}
