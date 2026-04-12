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
  paymentStatus: z.literal("verified").optional(),
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

  const { status, paymentStatus, note } = parsed.data
  if (!status && !paymentStatus) {
    return NextResponse.json({ error: "Status or paymentStatus is required" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: existingRequest, error: fetchError } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (fetchError || !existingRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  if (paymentStatus) {
    if (existingRequest.payment_method !== "bank-transfer") {
      return NextResponse.json({ error: "Only bank-transfer payments can be manually verified" }, { status: 400 })
    }

    if (existingRequest.payment_status !== "pending") {
      return NextResponse.json({ error: "Only pending bank-transfer payments can be verified" }, { status: 400 })
    }
  }

  const effectivePaymentStatus = paymentStatus || existingRequest.payment_status
  if (status && effectivePaymentStatus !== "verified") {
    return NextResponse.json({ error: "Only verified payments can move request status" }, { status: 400 })
  }

  const updateData: { request_status?: string; payment_status?: "verified" } = {}
  if (status) {
    updateData.request_status = status
  }
  if (paymentStatus) {
    updateData.payment_status = "verified"
  }

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
    event_type: paymentStatus ? "admin_payment_verified" : "admin_status_update",
    note:
      note ||
      (paymentStatus
        ? "Bank-transfer payment manually verified by admin"
        : "Request status updated from admin dashboard"),
    created_by: user.email || user.id,
    payload: {
      status: status || null,
      paymentStatus: paymentStatus || null,
    },
  })

  return NextResponse.json({ request: mapRequestRow(data) })
}
