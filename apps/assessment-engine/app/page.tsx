import { redirect } from "next/navigation";
import { env } from "../lib/env";

export const dynamic = "force-dynamic";

export default function Home() {
  redirect(env.CANDIDATE_PORTAL_URL);
}
