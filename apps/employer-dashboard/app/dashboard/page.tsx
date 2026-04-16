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
        Authorization: `Bearer ${sessionToken || "no-session"}` 
      },
      cache: "no-store",
    });
    
    initialCandidates = res.candidates;
  } catch (err: any) {
    // Graceful handling of server-side fetch failure or 401
    if (err?.status === 401) {
      redirect("/login");
    }
    initialCandidates = [];
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <Dashboard initialCandidates={initialCandidates} />
    </main>
  );
}
