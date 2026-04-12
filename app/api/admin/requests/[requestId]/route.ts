import { NextResponse } from "next/server"
import { z } from "zod"

import { mapRequestRow } from "@/lib/request-mappers"
import { createSupabaseAdminClient, getAuthenticatedAdminUser } from "@/lib/supabase/server"

const requestStatusSchema = z.enum([
  "pending",
  "confirmed",
  "worker-assigned",
  "in-progress",
  "completed",
  "cancelled",
])

const updateSchema = z.object({
  status: requestStatusSchema.optional(),
  note: z.string().trim().max(500).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const user = await getAuthenticatedAdminUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { requestId } = await params
  const payload = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 })
  }

  const { status, note } = parsed.data
  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const updateData: { request_status: string } = { request_status: status }

  const { data, error } = await supabase
    .from("service_requests")
    .update(updateData)
    .eq("id", requestId)
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Request not found" }, { status: 404 })
  }

  await supabase.from("request_events").insert({
    request_id: data.id,
    event_type: "admin_status_update",
    note: note || "Request status updated from admin dashboard",
    created_by: user.email || user.id,
    payload: {
      status,
    },
  })

  return NextResponse.json({ request: mapRequestRow(data) })
}
