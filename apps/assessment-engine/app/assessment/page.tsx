import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MCQInterface } from "../components/MCQInterface";
import { env } from "../../lib/env";

export const dynamic = "force-dynamic";

export default async function AssessmentPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("ae_session");

  if (!sessionCookie) {
    redirect("/auth/expired");
  }

  // Use our internal bypass to proxy requests to API Gateway acting as the user
  const internalToken = `engine_${sessionCookie.value}`;

  // 1. Get Application to find assessment ID
  const appRes = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/candidates/me/application`, {
    headers: { Authorization: `Bearer ${internalToken}` },
    cache: "no-store",
  });

  if (!appRes.ok) {
    console.error("Failed to fetch application", await appRes.text());
    return (
      <div className="assessment-container">
        <h2>Failed to load application</h2>
        <p>Your assessment session might have expired or you don't have an active application.</p>
      </div>
    );
  }

  const appData = await appRes.json();
  const assessmentSessionId = appData.data.assessmentSessionId;
  const applicationId = appData.data.applicationId;

  if (appData.data.status === "evaluated") {
    return (
      <div className="assessment-container">
        <h2>Assessment Already Completed</h2>
        <p>You have already completed this assessment.</p>
      </div>
    );
  }

  // 2. Fetch Questions
  const questionsRes = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/assessments/${assessmentSessionId}/questions`, {
    headers: { Authorization: `Bearer ${internalToken}` },
    cache: "no-store",
  });

  if (!questionsRes.ok) {
    console.error("Failed to fetch questions", await questionsRes.text());
    return (
      <div className="assessment-container">
        <h2>Failed to load questions</h2>
        <p>An error occurred retrieving the assessment questions. Please try again.</p>
      </div>
    );
  }

  const questionsData = await questionsRes.json();
  const questions = questionsData.data.questions;

  return (
    <div className="assessment-container">
      <MCQInterface 
        questions={questions} 
        applicationId={applicationId} 
      />
    </div>
  );
}
