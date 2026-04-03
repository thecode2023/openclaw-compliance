import { createAdminClient } from "@/lib/supabase/admin";
import { GraphClient } from "./GraphClient";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const supabase = createAdminClient();

  const [{ data: regulations }, { data: relationships }] = await Promise.all([
    supabase
      .from("regulations")
      .select("id, title, jurisdiction, jurisdiction_display, status, category, summary"),
    supabase
      .from("regulation_relationships")
      .select("id, source_regulation_id, target_regulation_id, relationship_type, description, strength"),
  ]);

  return (
    <GraphClient
      regulations={regulations || []}
      relationships={relationships || []}
    />
  );
}
