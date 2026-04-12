"use client"

import { motion } from "framer-motion"
import { Clock, DollarSign, Eye, FileText, LogOut, MapPin, Phone, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/Logo"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SERVICES, STATUS_CONFIG, type RequestStatus, type ServiceRequest } from "@/lib/pricing"

function formatDate(value?: string) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all")
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [nextStatus, setNextStatus] = useState<RequestStatus>("pending")
  const [updateNote, setUpdateNote] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalRequests, setTotalRequests] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadRequests() {
      setLoading(true)

      try {
        const params = new URLSearchParams()
        if (statusFilter !== "all") {
          params.set("status", statusFilter)
        }
        if (search.trim()) {
          params.set("search", search.trim())
        }
        params.set("page", String(page))
        params.set("pageSize", String(pageSize))

        const response = await fetch(`/api/admin/requests?${params.toString()}`, {
          signal: controller.signal,
        })
        const data = await response.json()

        if (!cancelled) {
          if (response.ok) {
            const nextRequests = data.requests || []
            setRequests(nextRequests)
            setTotalRequests(data.pagination?.total || 0)
            setTotalPages(data.pagination?.totalPages || 1)
            setSelectedRequest((current) => {
              if (current && nextRequests.some((item: ServiceRequest) => item.id === current)) {
                return current
              }

              return nextRequests[0]?.id || null
            })
          } else if (response.status === 401) {
            router.push("/fixnow-control")
          } else {
            setRequests([])
            toast.error(data?.error || "Unable to load requests")
          }
        }
      } catch {
        if (!cancelled) {
          setRequests([])
          toast.error("Unable to load requests")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadRequests()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [page, pageSize, search, statusFilter, router])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const selected = requests.find((request) => request.id === selectedRequest)

  useEffect(() => {
    if (!selected) return

    setNextStatus(selected.status)
    setUpdateNote("")
  }, [selected])

  async function handleLogout() {
    setLoggingOut(true)

    try {
      await fetch("/api/admin/logout", { method: "POST" })
      router.push("/fixnow-control")
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleUpdateStatuses() {
    if (!selected) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/admin/requests/${selected.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          note: updateNote || undefined,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/fixnow-control")
          return
        }

        toast.error(data?.error || "Unable to update request")
        return
      }

      const updated = data.request as ServiceRequest
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      toast.success("Request updated")
    } catch {
      toast.error("Unable to update request")
    } finally {
      setUpdating(false)
    }
  }

  const pendingRequests = requests.filter((request) => request.status === "pending").length
  const revenue = requests.reduce((sum, request) => sum + request.totalCost, 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Admin</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut}>
            <LogOut size={16} />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Total Requests", value: String(totalRequests), icon: FileText, color: "text-primary" },
            { label: "Pending", value: String(pendingRequests), icon: Clock, color: "text-warning" },
            { label: "Revenue", value: `Rs. ${revenue.toLocaleString()}`, icon: DollarSign, color: "text-success" },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass space-y-2 rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <stat.icon size={18} className={stat.color} />
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by name, ID, or location..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", ...Object.keys(STATUS_CONFIG)] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status as RequestStatus | "all")}
                className={statusFilter === status ? "gradient-primary text-primary-foreground" : ""}
              >
                {status === "all" ? "All" : STATUS_CONFIG[status as RequestStatus]?.label}
              </Button>
            ))}
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Refreshing requests...</p>}

        <div className="flex gap-6">
          <div className="glass flex-1 overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">ID</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Service</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Payment</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Cost</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request, index) => {
                    const service = SERVICES.find((entry) => entry.id === request.serviceId)
                    const serviceLabel =
                      request.serviceId === "other"
                        ? request.customServiceName || "Other Service"
                        : service?.label

                    return (
                      <motion.tr
                        key={request.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-secondary/50 ${
                          selectedRequest === request.id ? "bg-secondary" : ""
                        }`}
                        onClick={() => setSelectedRequest(request.id)}
                      >
                        <td className="p-4 font-mono text-xs font-semibold text-primary">{request.trackingId}</td>
                        <td className="p-4">
                          <p className="text-sm font-medium text-foreground">{request.requesterName}</p>
                          <p className="text-xs text-muted-foreground">{request.requesterCity}</p>
                        </td>
                        <td className="p-4 text-sm">
                          <span className="mr-1">{service?.icon}</span>
                          {serviceLabel}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={request.status} />
                        </td>
                        <td className="p-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              request.paymentStatus === "paid" || request.paymentStatus === "verified"
                                ? "bg-success/15 text-success"
                                : request.paymentStatus === "failed" || request.paymentStatus === "cancelled"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-warning/15 text-warning-foreground"
                            }`}
                          >
                            {request.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-semibold text-foreground">
                          Rs. {request.totalCost.toLocaleString()}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground"
                            onClick={() => setSelectedRequest(request.id)}
                          >
                            <Eye size={14} />
                          </Button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>
                Page {page} of {Math.max(totalPages, 1)} · {totalRequests} total requests
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass hidden w-80 shrink-0 space-y-4 rounded-xl p-5 lg:block"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground">Request Details</h3>
                <StatusBadge status={selected.status} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{SERVICES.find((entry) => entry.id === selected.serviceId)?.icon}</span>
                  <span className="font-medium text-foreground">
                    {selected.serviceId === "other"
                      ? selected.customServiceName || "Other Service"
                      : SERVICES.find((entry) => entry.id === selected.serviceId)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone size={14} className="text-primary" />
                  {selected.requesterPhone}
                </div>
                {selected.requesterEmail && (
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="mb-1 text-xs text-muted-foreground">Email</p>
                    <p className="text-sm text-foreground">{selected.requesterEmail}</p>
                  </div>
                )}
                {selected.requesterAddress && (
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="mb-1 text-xs text-muted-foreground">Address</p>
                    <p className="text-sm text-foreground">{selected.requesterAddress}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={14} className="text-primary" />
                  {selected.requesterCity}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>Urgency: <span className="font-medium text-foreground">{selected.urgency}</span></p>
                  <p>Duration: <span className="font-medium text-foreground">{selected.duration}</span></p>
                  <p>Created: <span className="font-medium text-foreground">{formatDate(selected.createdAt)}</span></p>
                  <p>Scheduled: <span className="font-medium text-foreground">{formatDate(selected.scheduledDate)}</span></p>
                </div>
                {selected.otherInfo && (
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground">{selected.otherInfo}</p>
                  </div>
                )}
                <div className="border-t border-border pt-3">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Tracking ID</span>
                    <span className="font-medium text-foreground">{selected.trackingId}</span>
                  </div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="font-medium text-foreground capitalize">
                      {selected.paymentMethod.replace("-", " ")}
                    </span>
                  </div>
                  {selected.payhereOrderId && (
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Order ID</span>
                      <span className="font-medium text-foreground">{selected.payhereOrderId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-display text-lg font-bold text-primary">
                      Rs. {selected.totalCost.toLocaleString()}
                    </span>
                  </div>
                </div>
                {selected.paymentMethod === "bank-transfer" && selected.receiptUrl && (
                  <a href={selected.receiptUrl} target="_blank" rel="noreferrer" className="block">
                    <Button variant="outline" size="sm" className="w-full">
                      <FileText size={14} className="mr-2" /> View Receipt
                    </Button>
                  </a>
                )}
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground">Update Process Status</p>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value as RequestStatus)}
                  >
                    {(Object.keys(STATUS_CONFIG) as RequestStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {STATUS_CONFIG[status].label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Optional update note"
                    value={updateNote}
                    onChange={(event) => setUpdateNote(event.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={updating}
                    className="gradient-primary w-full text-xs text-primary-foreground"
                    onClick={handleUpdateStatuses}
                  >
                    {updating ? "Updating..." : "Save Update"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {!loading && requests.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
            No requests found for the current filters.
          </div>
        )}
      </div>
    </div>
  )
}
