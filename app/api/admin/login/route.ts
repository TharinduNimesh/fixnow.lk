import { NextResponse } from "next/server"

import { createSupabaseServerAuthClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const email = typeof payload?.email === "string" ? payload.email.trim() : ""
  const password = typeof payload?.password === "string" ? payload.password : ""

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const supabase = await createSupabaseServerAuthClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  })
}
