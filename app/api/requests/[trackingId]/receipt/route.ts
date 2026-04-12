import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"]
const BUCKET_NAME = "request-receipts"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> },
) {
  const { trackingId } = await params
  const clientId = await getClientIdentifier()
  const endpoint = "/api/requests/[trackingId]/receipt"

  // Rate limiting
  const { allowed, remaining, resetIn } = checkRateLimit(endpoint, clientId)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many upload requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)),
        },
      },
    )
  }

  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get("receipt") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.` },
        { status: 400 },
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload PNG, JPG, or PDF." },
        { status: 400 },
      )
    }

    // Get request from database
    const supabase = createSupabaseAdminClient()
    const { data: requestData, error: fetchError } = await supabase
      .from("service_requests")
      .select("*")
      .eq("tracking_id", trackingId)
      .single()

    if (fetchError || !requestData) {
      console.error("[Receipt Upload] Request not found:", { trackingId, fetchError })
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const request_id = requestData.id

    // Only allow receipt uploads for bank-transfer payments
    if (requestData.payment_method !== "bank-transfer") {
      console.warn("[Receipt Upload] Invalid payment method for receipt:", {
        trackingId,
        paymentMethod: requestData.payment_method,
      })
      return NextResponse.json(
        { error: "Receipts can only be uploaded for bank-transfer payments" },
        { status: 400 },
      )
    }

    // Generate file name: {tracking_id}/{request_id}_{timestamp}.{ext}
    const ext = file.type === "application/pdf" ? "pdf" : file.name.split(".").pop() || "jpg"
    const timestamp = Date.now()
    const fileName = `${trackingId}/${request_id}_${timestamp}.${ext}`
    const filePath = `request-receipts/${fileName}`

    // Upload to Supabase Storage
    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("[Receipt Upload] Storage upload failed:", {
        trackingId,
        fileName,
        error: uploadError.message,
      })
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 },
      )
    }

    // Get public URL or signed URL
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)
    const receiptUrl = urlData?.publicUrl || filePath

    // Update database with receipt info
    const { error: updateError } = await supabase
      .from("service_requests")
      .update({
        receipt_path: receiptUrl,
        receipt_uploaded_at: new Date().toISOString(),
      })
      .eq("tracking_id", trackingId)

    if (updateError) {
      console.error("[Receipt Upload] Database update failed:", {
        trackingId,
        updateError: updateError.message,
      })
      // Delete uploaded file if database update fails
      await supabase.storage.from(BUCKET_NAME).remove([fileName])
      return NextResponse.json(
        { error: "Failed to save receipt information" },
        { status: 500 },
      )
    }

    // Log event
    await supabase.from("request_events").insert({
      request_id,
      event_type: "receipt_uploaded",
      note: `Receipt uploaded: ${file.name}`,
      payload: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath: fileName,
      },
    })

    console.log("[Receipt Upload] Success:", {
      trackingId,
      fileName: file.name,
      size: file.size,
      storagePath: fileName,
    })

    return NextResponse.json(
      {
        success: true,
        message: "Receipt uploaded successfully",
        receiptPath: receiptUrl,
        fileName: file.name,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(remaining),
        },
      },
    )
  } catch (error) {
    console.error("[Receipt Upload] Unexpected error:", {
      trackingId: params.then((p) => p.trackingId),
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "An unexpected error occurred during upload" },
      { status: 500 },
    )
  }
}
