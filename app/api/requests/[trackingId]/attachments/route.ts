import { NextResponse } from "next/server"

import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3MB
const MAX_FILES = 5
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"]
const BUCKET_NAME = "request-receipts"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> },
) {
  const { trackingId } = await params
  const clientId = await getClientIdentifier()
  const endpoint = "/api/requests/[trackingId]/attachments"

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
    const formData = await request.formData()
    const files = formData.getAll("attachments").filter((entry): entry is File => entry instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: "Maximum 5 files are allowed." }, { status: 400 })
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File too large (${file.name}). Maximum size is 3MB.`,
          },
          { status: 400 },
        )
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type for ${file.name}. Please upload PNG, JPG, or PDF.`,
          },
          { status: 400 },
        )
      }
    }

    const supabase = createSupabaseAdminClient()
    const { data: requestData, error: fetchError } = await supabase
      .from("service_requests")
      .select("id, metadata")
      .eq("tracking_id", trackingId)
      .single()

    if (fetchError || !requestData) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const uploadedUrls: string[] = []
    const uploadedPaths: string[] = []

    for (const file of files) {
      const ext = file.type === "application/pdf" ? "pdf" : file.name.split(".").pop() || "jpg"
      const timestamp = Date.now()
      const baseName = file.name.replace(/\.[^.]+$/, "")
      const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_")
      const fileName = `attachments/${trackingId}/${requestData.id}_${timestamp}_${safeName}.${ext}`
      const buffer = await file.arrayBuffer()

      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

      if (uploadError) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths)
        }
        return NextResponse.json({ error: "Failed to upload attachment files" }, { status: 500 })
      }

      uploadedPaths.push(fileName)
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)
      uploadedUrls.push(urlData?.publicUrl || fileName)
    }

    const existingMetadata =
      requestData.metadata && typeof requestData.metadata === "object"
        ? (requestData.metadata as Record<string, unknown>)
        : {}

    const existingUrls = Array.isArray(existingMetadata.attachmentUrls)
      ? existingMetadata.attachmentUrls.filter((value): value is string => typeof value === "string")
      : []

    const mergedUrls = [...existingUrls, ...uploadedUrls].slice(0, MAX_FILES)

    const { error: updateError } = await supabase
      .from("service_requests")
      .update({
        metadata: {
          ...existingMetadata,
          attachmentUrls: mergedUrls,
        },
      })
      .eq("tracking_id", trackingId)

    if (updateError) {
      await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths)
      return NextResponse.json({ error: "Failed to save attachment metadata" }, { status: 500 })
    }

    await supabase.from("request_events").insert({
      request_id: requestData.id,
      event_type: "attachments_uploaded",
      note: `Uploaded ${uploadedUrls.length} attachment(s)`,
      payload: {
        count: uploadedUrls.length,
        urls: uploadedUrls,
      },
    })

    return NextResponse.json(
      {
        success: true,
        attachmentUrls: mergedUrls,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(remaining),
        },
      },
    )
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred during upload" }, { status: 500 })
  }
}
