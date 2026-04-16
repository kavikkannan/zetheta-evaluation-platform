import type { Metadata } from "next";
import { Dashboard } from "../components/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard · Candidate Portal",
  description: "Your assessment dashboard. Start your technical assessment from here.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
