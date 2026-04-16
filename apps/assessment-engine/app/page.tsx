import { redirect } from "next/navigation";
import { env } from "../lib/env";

export default function Home() {
  redirect(env.CANDIDATE_PORTAL_URL);
}
