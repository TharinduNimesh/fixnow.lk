export const SERVICES = [
  { id: "mechanic", label: "Mechanic", icon: "🔧", baseRate: 3500 },
  { id: "plumber", label: "Plumber", icon: "🪠", baseRate: 3000 },
  { id: "electrician", label: "Electrician", icon: "⚡", baseRate: 3500 },
  { id: "construction", label: "Construction Worker", icon: "🏗️", baseRate: 2500 },
  { id: "cleaner", label: "Cleaner", icon: "🧹", baseRate: 2000 },
  { id: "painter", label: "Painter", icon: "🎨", baseRate: 2500 },
  { id: "carpenter", label: "Carpenter", icon: "🪚", baseRate: 3000 },
  { id: "gardener", label: "Gardener", icon: "🌿", baseRate: 2000 },
  { id: "other", label: "Other Service", icon: "🧰", baseRate: 3000 },
] as const

export const URGENCY_OPTIONS = [
  { id: "within-hour", label: "Within 1 Hour", multiplier: 2.0, tag: "Urgent" },
  { id: "within-24h", label: "Within 24 Hours", multiplier: 1.5, tag: "Priority" },
  { id: "specific-date", label: "Specific Date", multiplier: 1.0, tag: "Scheduled" },
] as const

export const DURATION_OPTIONS = [
  { id: "half-day", label: "Half Day", hours: 4, multiplier: 0.5 },
  { id: "full-day", label: "Full Day", hours: 8, multiplier: 1.0 },
  { id: "two-days", label: "2 Days", hours: 16, multiplier: 1.9 },
  { id: "three-days", label: "3 Days", hours: 24, multiplier: 2.7 },
] as const

export function calculateCost(serviceId: string, urgencyId: string, durationId: string): number {
  const service = SERVICES.find((serviceItem) => serviceItem.id === serviceId)
  const urgency = URGENCY_OPTIONS.find((urgencyItem) => urgencyItem.id === urgencyId)
  const duration = DURATION_OPTIONS.find((durationItem) => durationItem.id === durationId)

  if (!service || !urgency || !duration) return 0

  return Math.round(service.baseRate * urgency.multiplier * duration.multiplier)
}

export type RequestStatus =
  | "pending"
  | "confirmed"
  | "worker-assigned"
  | "in-progress"
  | "completed"
  | "cancelled"

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "warning" },
  confirmed: { label: "Confirmed", color: "info" },
  "worker-assigned": { label: "Worker Assigned", color: "primary" },
  "in-progress": { label: "In Progress", color: "primary" },
  completed: { label: "Completed", color: "success" },
  cancelled: { label: "Cancelled", color: "destructive" },
}

export interface ServiceRequest {
  id: string
  trackingId: string
  requesterName: string
  requesterEmail?: string | null
  requesterPhone: string
  requesterAddress?: string | null
  requesterCity: string
  serviceId: string
  customServiceName?: string | null
  urgency: string
  scheduledDate?: string
  duration: string
  otherInfo?: string
  paymentMethod: "card" | "bank-transfer"
  paymentStatus: "pending" | "initiated" | "paid" | "verified" | "failed" | "cancelled"
  receiptUrl?: string
  totalCost: number
  status: RequestStatus
  payhereOrderId?: string | null
  payherePaymentId?: string | null
  payhereStatusCode?: number | null
  sourcePath?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
}

export const BANK_INFO = {
  bankName: "Bank of Ceylon",
  accountName: "FIXNOW (PVT) LTD",
  accountNumber: "0012345678",
  branch: "Colombo Main Branch",
  swiftCode: "BCEYLKLX",
}
