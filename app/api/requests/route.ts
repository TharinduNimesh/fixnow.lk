import { NextResponse } from "next/server"

import { calculateCost } from "@/lib/pricing"
import { mapRequestRow } from "@/lib/request-mappers"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { requestCreateSchema } from "@/lib/request-validation"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)

  // Rate limiting
  const clientId = await getClientIdentifier()
  const endpoint = "/api/requests"
  const { allowed, resetIn } = checkRateLimit(endpoint, clientId)

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)),
        },
      },
    )
  }

  const parsed = requestCreateSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const input = parsed.data
  const supabase = createSupabaseAdminClient()
  const normalizedScheduledDates =
    input.urgency === "specific-date"
      ? Array.from(new Set((input.scheduledDates || []).filter(Boolean))).sort()
      : []
  const normalizedDuration = input.urgency === "specific-date" ? "full-day" : (input.duration || "full-day")
  // Server-side price calculation from validated inputs
  // Frontend estimate is for UX only; this is the authoritative value stored in DB
  const totalCost = calculateCost(input.serviceId, input.urgency, normalizedDuration, {
    workersNeeded: input.workersNeeded,
    needsSupervisor: input.needsSupervisor,
    scheduledDates: normalizedScheduledDates,
  })
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
  const userAgent = request.headers.get("user-agent")

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      requester_name: input.requesterName,
      requester_email: input.requesterEmail,
      requester_phone: input.requesterPhone,
      requester_address: input.requesterAddress,
      requester_city: input.requesterCity,
      service_id: input.serviceId,
      custom_service_name: input.customServiceName || null,
      urgency: input.urgency,
      scheduled_date: normalizedScheduledDates[0] || input.scheduledDate || null,
      duration: normalizedDuration,
      other_info: input.otherInfo || null,
      payment_method: input.paymentMethod,
      payment_status: input.paymentMethod === "card" ? "initiated" : "pending",
      request_status: "pending",
      total_cost: totalCost,
      currency: "LKR",
      source_path: input.sourcePath || request.headers.get("referer") || null,
      client_ip: clientIp,
      user_agent: userAgent,
      metadata: {
        requestedServiceLabel: input.serviceId,
        workersNeeded: input.workersNeeded,
        distanceFromBorella: input.distanceFromBorella,
        requesterPhoneSecondary: input.requesterPhoneSecondary,
        scheduledDates: normalizedScheduledDates,
        needsSupervisor: Boolean(input.needsSupervisor),
        termsAccepted: true,
      },
    })
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Unable to save service request", details: error?.message },
      { status: 500 },
    )
  }

  await supabase.from("request_events").insert({
    request_id: data.id,
    event_type: "request_created",
    note: "Request submitted from the public frontend",
    payload: {
      paymentMethod: input.paymentMethod,
      serviceId: input.serviceId,
      urgency: input.urgency,
        duration: normalizedDuration,
        workersNeeded: input.workersNeeded,
        distanceFromBorella: input.distanceFromBorella,
        scheduledDates: normalizedScheduledDates,
        needsSupervisor: Boolean(input.needsSupervisor),
    },
  })

  return NextResponse.json(
    {
      request: mapRequestRow(data),
      nextAction: input.paymentMethod === "card" ? "payhere" : "bank-transfer",
    },
    { status: 201 },
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const trackingId = url.searchParams.get("trackingId")
  const status = url.searchParams.get("status")
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200)

  const supabase = createSupabaseAdminClient()

  let query = supabase.from("service_requests").select("*").order("created_at", { ascending: false }).limit(limit)

  if (trackingId) {
    query = query.eq("tracking_id", trackingId)
  }

  if (status) {
    query = query.eq("request_status", status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: (data || []).map(mapRequestRow) })
}
