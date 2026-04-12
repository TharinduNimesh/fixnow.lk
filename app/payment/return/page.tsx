"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { Logo } from "@/components/Logo"
import { Button } from "@/components/ui/button"
import type { ServiceRequest } from "@/lib/pricing"

function PaymentReturnContent() {
  const searchParams = useSearchParams()
  const trackingId = searchParams.get("tracking_id")
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!trackingId) {
      setLoading(false)
      return
    }

    async function fetchRequest() {
      try {
        const response = await fetch(`/api/requests/${trackingId}`)
        if (response.ok) {
          const data = await response.json()
          setRequest(data.request)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [trackingId])

  const isVerified = request?.paymentStatus === "verified"
  const isFailed = request?.paymentStatus === "failed" || request?.paymentStatus === "cancelled"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-4">
        <Logo />
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="glass w-full max-w-md space-y-4 rounded-2xl p-6 text-center">
          {loading ? (
            <>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-primary border-r-primary border-b-transparent border-l-transparent"></div>
              <p className="text-sm text-muted-foreground">Loading payment status...</p>
            </>
          ) : notFound ? (
            <>
              <h1 className="font-display text-2xl font-bold text-destructive">Payment Could Not Be Confirmed</h1>
              <p className="text-sm text-muted-foreground">
                The payment request was not completed or was removed after a failed payment attempt.
                Please return to the home page and submit again if needed.
              </p>
            </>
          ) : isFailed ? (
            <>
              <h1 className="font-display text-2xl font-bold text-destructive">Payment Failed</h1>
              <p className="text-sm text-muted-foreground">
                Unfortunately, the payment could not be processed. Please try again or contact support.
              </p>
            </>
          ) : isVerified ? (
            <>
              <h1 className="font-display text-2xl font-bold text-primary">Payment Verified!</h1>
              <p className="text-sm text-muted-foreground">
                Your payment has been successfully processed and verified through our secure server callback.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground">Payment Received</h1>
              <p className="text-sm text-muted-foreground">
                We&apos;ve received your PayHere redirect. Payment verification is in progress.
              </p>
            </>
          )}

          {trackingId && (
            <p className="rounded-lg bg-secondary p-3">
              <span className="block text-xs text-muted-foreground">Tracking ID</span>
              <span className="font-mono font-semibold text-foreground">{trackingId}</span>
            </p>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {trackingId ? (
              <Link
                href={`/track/${trackingId}`}
                className="gradient-primary inline-flex h-11 flex-1 items-center justify-center rounded-md text-sm font-semibold text-primary-foreground"
              >
                Track Request
              </Link>
            ) : (
              <Button asChild className="gradient-primary flex-1 text-primary-foreground">
                <Link href="/">Go Home</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">Start Over</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-primary border-r-primary border-b-transparent border-l-transparent"></div>
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  )
}
