import { NextResponse } from "next/server"

import { mapRequestRows } from "@/lib/request-mappers"
import { createSupabaseAdminClient, getAuthenticatedAdminUser } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const user = await getAuthenticatedAdminUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const search = url.searchParams.get("search")
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || 20), 1), 100)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createSupabaseAdminClient()

  let query = supabase
    .from("service_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (status && status !== "all") {
    query = query.eq("request_status", status)
  }

  if (search?.trim()) {
    const term = search.trim().replaceAll(",", "\\,").replaceAll("(", "\\(").replaceAll(")", "\\)")
    query = query.or(
      [
        `requester_name.ilike.%${term}%`,
        `requester_phone.ilike.%${term}%`,
        `requester_city.ilike.%${term}%`,
        `tracking_id.ilike.%${term}%`,
        `service_id.ilike.%${term}%`,
        `custom_service_name.ilike.%${term}%`,
      ].join(","),
    )
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    requests: mapRequestRows(data || []),
    pagination: {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(Math.ceil((count || 0) / pageSize), 1),
    },
  })
}
