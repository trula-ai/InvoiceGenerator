import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";

/** Entry point: send signed-in users to the dashboard, everyone else to login. */
export default async function Home() {
  const current = await getCurrentUser();
  redirect(current ? "/dashboard" : "/login");
}
