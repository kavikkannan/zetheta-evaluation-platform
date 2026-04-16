import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiRequest } from "../../lib/api-client";
import { Dashboard } from "../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("e_session")?.value;

  // For this phase, if no session, we'll just mock it or provide a way to bypass
  // In a real app we'd redirect to /login
  // if (!sessionToken) {
  //   redirect("/login");
  // }

  let initialCandidates = [];
  try {
    const res = await apiRequest<{ candidates: any[] }>("/dashboard/candidates", {
      headers: { 
        // We'll use a placeholder or the actual session token if present
        Authorization: `Bearer ${sessionToken || "mock-employer-token"}` 
      },
      cache: "no-store",
    });
    initialCandidates = res.candidates;
  } catch (err) {
    console.error("Failed to fetch initial candidates:", err);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <Dashboard initialCandidates={initialCandidates} />
    </main>
  );
}
