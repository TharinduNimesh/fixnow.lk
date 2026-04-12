import { NextResponse } from "next/server"

import { createSupabaseServerAuthClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createSupabaseServerAuthClient()
  await supabase.auth.signOut()

  return NextResponse.json({ success: true })
}
