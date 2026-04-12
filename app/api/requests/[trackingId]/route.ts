import { NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { mapRequestRow } from "@/lib/request-mappers"

export async function GET(_request: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await params
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("tracking_id", trackingId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  return NextResponse.json({ request: mapRequestRow(data) })
}
