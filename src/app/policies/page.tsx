import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/server";
import { PoliciesClient } from "./PoliciesClient";
import type { Regulation } from "@/lib/types/regulation";
import type { PolicyDocument } from "@/lib/types/policy";

export default async function PoliciesPage() {
  const supabase = await createServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.onboarded) {
    redirect("/dashboard/onboarding");
  }

  // Fetch regulations for the generator dropdown
  const { data: regulations } = await supabase
    .from("regulations")
    .select("id, title, jurisdiction, jurisdiction_display, status, category")
    .order("title");

  // Fetch user's saved policies
  const { data: policies } = await supabase
    .from("policy_documents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <PoliciesClient
      regulations={(regulations as Regulation[]) || []}
      policies={(policies as PolicyDocument[]) || []}
      userIndustry={profile.industry || ""}
    />
  );
}
