"use client"

import { motion } from "framer-motion"
import { CalendarDays, CheckCircle2, Circle, Clock, MapPin, User } from "lucide-react"
import { use, useEffect, useState } from "react"

import { Logo } from "@/components/Logo"
import { StatusBadge } from "@/components/StatusBadge"
import { MOCK_REQUESTS } from "@/lib/mockData"
import { type ServiceRequest, DURATION_OPTIONS, getServiceById, type RequestStatus, URGENCY_OPTIONS } from "@/lib/pricing"

const TIMELINE: { status: RequestStatus; label: string; icon: typeof Circle }[] = [
  { status: "pending", label: "Request Received", icon: Circle },
  { status: "confirmed", label: "Confirmed", icon: Circle },
  { status: "worker-assigned", label: "Worker Assigned", icon: User },
  { status: "in-progress", label: "Work In Progress", icon: Clock },
  { status: "completed", label: "Completed", icon: CheckCircle2 },
]

const STATUS_ORDER: RequestStatus[] = [
  "pending",
  "confirmed",
  "worker-assigned",
  "in-progress",
  "completed",
]

export default function TrackRequestPage({
  params,
}: {
  params: Promise<{ requestCode: string }>
}) {
  const { requestCode } = use(params)
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadRequest() {
      setLoading(true)

      try {
        const response = await fetch(`/api/requests/${encodeURIComponent(requestCode)}`)
        const data = await response.json()

        if (!cancelled) {
          if (response.ok) {
            setRequest(data.request)
          } else {
            setRequest(MOCK_REQUESTS[0])
          }
        }
      } catch {
        if (!cancelled) {
          setRequest(MOCK_REQUESTS[0])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadRequest()

    return () => {
      cancelled = true
    }
  }, [requestCode])

  const activeRequest = request || MOCK_REQUESTS[0]

  const currentStatusIndex = STATUS_ORDER.indexOf(activeRequest.status)
  const service = getServiceById(activeRequest.serviceId)
  const serviceLabel =
    activeRequest.serviceId === "other"
      ? activeRequest.customServiceName || "Other Service"
      : service?.label

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-4">
        <Logo />
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col space-y-6 px-4 py-8">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Track Your Request</h1>
          <p className="text-sm text-muted-foreground">
            Tracking ID: <span className="font-mono font-semibold text-primary">{requestCode}</span>
          </p>
        </div>

        {loading && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Loading request details...
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          <div className="space-y-0">
            {TIMELINE.map((item, index) => {
              const isReached = index <= currentStatusIndex
              const isCurrent = index === currentStatusIndex
              const Icon = item.icon

              return (
                <div key={item.status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isCurrent
                          ? "gradient-primary animate-pulse-glow"
                          : isReached
                            ? "bg-primary"
                            : "bg-muted"
                      }`}
                    >
                      <Icon
                        size={14}
                        className={isReached ? "text-primary-foreground" : "text-muted-foreground"}
                      />
                    </div>
                    {index < TIMELINE.length - 1 && (
                      <div className={`h-8 w-0.5 ${isReached ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                  <div className="pb-6">
                    <p
                      className={`text-sm font-semibold ${
                        isCurrent
                          ? "text-primary"
                          : isReached
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </p>
                    {isCurrent && <StatusBadge status={activeRequest.status} />}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass space-y-4 rounded-2xl p-6"
        >
          <h3 className="font-display font-semibold text-foreground">Request Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">{service?.icon}</span>
              <span className="font-medium text-foreground">{serviceLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-primary" />
              <span className="text-foreground">{activeRequest.requesterCity}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-primary" />
              <span className="text-foreground">
                {URGENCY_OPTIONS.find((entry) => entry.id === activeRequest.urgency)?.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays size={16} className="text-primary" />
              <span className="text-foreground">
                {DURATION_OPTIONS.find((entry) => entry.id === activeRequest.duration)?.label}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total Cost</span>
            <span className="font-display text-xl font-bold text-primary">
              Rs. {activeRequest.totalCost.toLocaleString()}
            </span>
          </div>
        </motion.div>

        <div className="rounded-xl bg-secondary p-4 text-center">
          <p className="text-sm text-secondary-foreground">
            📞 Need help? Contact us at{" "}
            <a href="tel:+94112345678" className="font-semibold text-primary">
              +94 11 234 5678
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
