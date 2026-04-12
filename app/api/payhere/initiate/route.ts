import { NextResponse } from "next/server"

import { buildPayHerePayload } from "@/lib/payhere"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { payhereInitiateSchema } from "@/lib/request-validation"
import { mapRequestRow } from "@/lib/request-mappers"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  // Rate limiting
  const clientId = await getClientIdentifier()
  const endpoint = "/api/payhere/initiate"
  const { allowed, resetIn } = checkRateLimit(endpoint, clientId)

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many checkout requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)),
        },
      },
    )
  }

  const parsed = payhereInitiateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid PayHere initiation payload", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("tracking_id", parsed.data.trackingId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  const requestRecord = mapRequestRow(data)

  if (requestRecord.paymentMethod !== "card") {
    return NextResponse.json({ error: "PayHere is only available for card payments" }, { status: 400 })
  }

  const payhereOrderId = requestRecord.payhereOrderId || requestRecord.trackingId

  const { error: updateError } = await supabase
    .from("service_requests")
    .update({
      payhere_order_id: payhereOrderId,
      payment_status: "initiated",
      request_status: "pending",
    })
    .eq("tracking_id", requestRecord.trackingId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const payload = buildPayHerePayload({
    ...requestRecord,
    payhereOrderId,
  })

  await supabase.from("request_events").insert({
    request_id: requestRecord.id,
    event_type: "payhere_initiated",
    note: "Redirect payload created for PayHere checkout",
    payload: {
      orderId: payhereOrderId,
    },
  })

  return NextResponse.json(payload)
}
