import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/server";
import { PendingReviewClient } from "@/components/dashboard/PendingReviewClient";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: pending } = await supabase
    .from("pending_regulations")
    .select("*")
    .in("review_status", ["pending", "uncertain"])
    .order("detected_at", { ascending: false });

  return <PendingReviewClient items={pending ?? []} />;
}
