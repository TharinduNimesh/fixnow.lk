import { NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { verifyPayHereCallback } from "@/lib/payhere"

async function readFormData(request: Request) {
  const formData = await request.formData()
  const entries = Object.fromEntries(formData.entries())

  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  ) as Record<string, string>
}

export async function POST(request: Request) {
  const form = await readFormData(request)
  const requiredFields = [
    "merchant_id",
    "order_id",
    "payhere_amount",
    "payhere_currency",
    "status_code",
    "md5sig",
  ] as const

  const missingFields = requiredFields.filter((field) => !form[field])
  if (missingFields.length > 0) {
    return NextResponse.json({ error: "Missing PayHere parameters", missingFields }, { status: 400 })
  }

  const isValid = verifyPayHereCallback({
    merchant_id: form.merchant_id,
    order_id: form.order_id,
    payhere_amount: form.payhere_amount,
    payhere_currency: form.payhere_currency,
    status_code: form.status_code,
    md5sig: form.md5sig,
  })

  if (!isValid) {
    return NextResponse.json({ error: "Invalid PayHere signature" }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("tracking_id", form.order_id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  // Extra validation: Verify amount matches what we stored in database
  // This is an additional security layer to detect tampered amounts
  const storedAmount = data.total_cost.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replaceAll(",", "")
  const callbackAmount = form.payhere_amount

  if (storedAmount !== callbackAmount) {
    // Log the mismatch as a potential fraud attempt
    await supabase.from("request_events").insert({
      request_id: data.id,
      event_type: "payhere_amount_mismatch",
      note: `Callback amount ${callbackAmount} LKR does not match stored amount ${storedAmount} LKR`,
      payload: { stored: storedAmount, callback: callbackAmount, form },
    })

    return NextResponse.json(
      { error: "Amount mismatch detected" },
      { status: 403 },
    )
  }

  if (form.status_code === "2") {
    const { error: updateError } = await supabase
      .from("service_requests")
      .update({
        payment_status: "verified",
        request_status: "confirmed",
        payhere_payment_id: form.payment_id || null,
        payhere_status_code: Number(form.status_code),
        payhere_method: form.method || null,
      })
      .eq("tracking_id", form.order_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from("request_events").insert({
      request_id: data.id,
      event_type: "payhere_notification",
      note: "PayHere payment verified and request confirmed",
      payload: form,
    })

    return new NextResponse("OK", { status: 200 })
  }

  await supabase.from("service_requests").delete().eq("tracking_id", form.order_id)

  return new NextResponse("OK", { status: 200 })
}
