import { headers } from "next/headers"
import { NextResponse } from "next/server"

// In-memory store for rate limiting (resets on server restart)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Configure rate limits per endpoint (requests per window)
export const RATE_LIMIT_CONFIG = {
  "/api/requests": { maxRequests: 5, windowMs: 60 * 1000 }, // 5 requests per minute
  "/api/requests/[trackingId]/receipt": { maxRequests: 3, windowMs: 60 * 1000 }, // 3 uploads per minute
  "/api/payhere/initiate": { maxRequests: 10, windowMs: 60 * 1000 }, // 10 initiations per minute
  "/api/payhere/notify": { maxRequests: 100, windowMs: 60 * 1000 }, // PayHere can send multiple notifications
}

export async function getClientIdentifier(): Promise<string> {
  const headersList = await headers()
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown"
  )
}

export function checkRateLimit(
  endpoint: string,
  clientId: string,
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG]
  if (!config) {
    return { allowed: true, remaining: -1, resetIn: 0 } // No limit configured
  }

  const key = `${endpoint}:${clientId}`
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs }
  }

  if (record.count < config.maxRequests) {
    record.count++
    return { allowed: true, remaining: config.maxRequests - record.count, resetIn: record.resetTime - now }
  }

  // Rate limit exceeded
  return { allowed: false, remaining: 0, resetIn: record.resetTime - now }
}

export function rateLimitMiddleware(endpoint: string) {
  return (handler: (request: Request) => Promise<NextResponse>) => {
    return async (request: Request) => {
      const clientId = await getClientIdentifier()
      const { allowed, remaining, resetIn } = checkRateLimit(endpoint, clientId)

      const responseHeaders = {
        "X-RateLimit-Limit": String(RATE_LIMIT_CONFIG[endpoint as keyof typeof RATE_LIMIT_CONFIG]?.maxRequests || "unlimited"),
        "X-RateLimit-Remaining": String(Math.max(0, remaining)),
        "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)),
      }

      if (!allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429, headers: responseHeaders },
        )
      }

      // Call the actual handler and add headers to response
      const response = await handler(request)
      Object.entries(responseHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      return response
    }
  }
}
