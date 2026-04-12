import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function createSupabaseAdminClient() {
  return createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function createSupabaseServerAuthClient() {
  const cookieStore = await cookies()

  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )
}

export async function getAuthenticatedAdminUser() {
  const supabase = await createSupabaseServerAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
