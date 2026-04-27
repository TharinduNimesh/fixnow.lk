export const SERVICES = [
  { id: "welder", label: "Welder", icon: "🛠️", baseRate: 3500 },
  { id: "plumber", label: "Plumber", icon: "🪠", baseRate: 3000 },
  { id: "electrician", label: "Electrician", icon: "⚡", baseRate: 3500 },
  { id: "general-labor", label: "General Labor", icon: "👷", baseRate: 2500 },
  { id: "cleaner", label: "Cleaner", icon: "🧹", baseRate: 2000 },
  { id: "painter", label: "Painter", icon: "🎨", baseRate: 2500 },
  { id: "formwork-carpenter", label: "Formwork Carpenter", icon: "🪚", baseRate: 3000 },
  { id: "steel-worker", label: "Steel Worker", icon: "🏗️", baseRate: 3000 },
  { id: "mason", label: "Mason", icon: "🧱", baseRate: 2800 },
  { id: "ceiling-installer", label: "Ceiling Installer", icon: "🪜", baseRate: 2800 },
  { id: "tile-fixer", label: "Tile Fixer", icon: "🧩", baseRate: 2800 },
  { id: "aluminum-door-window-technician", label: "Aluminum Door/Window Technician", icon: "🪟", baseRate: 3200 },
  { id: "bathroom-fitter", label: "Bathroom Fitter", icon: "🚿", baseRate: 3000 },
  { id: "ac-technician", label: "A/C Technician", icon: "❄️", baseRate: 3200 },
  { id: "other", label: "Other Service", icon: "🧰", baseRate: 3000 },
] as const

const SERVICE_ALIASES: Record<string, string> = {
  mechanic: "welder",
  construction: "general-labor",
  carpenter: "formwork-carpenter",
  gardener: "steel-worker",
}

export function resolveServiceId(serviceId: string) {
  return SERVICE_ALIASES[serviceId] || serviceId
}

export function getServiceById(serviceId: string) {
  const resolvedServiceId = resolveServiceId(serviceId)
  return SERVICES.find((serviceItem) => serviceItem.id === resolvedServiceId)
}

export const URGENCY_OPTIONS = [
  { id: "within-hour", label: "Within 6-12 Hours", tag: "Priority" },
  { id: "within-24h", label: "Within 24 Hours", tag: "Standard" },
  { id: "specific-date", label: "Scheduled (Advanced)", tag: "Planned" },
] as const

export const DURATION_OPTIONS = [
  { id: "half-day", label: "Half Day (4 Hours)", hours: 4, days: 1, price: 5999 },
  { id: "full-day", label: "Full Day (8 Hours)", hours: 8, days: 1, price: 9999 },
  { id: "two-days", label: "Two Days", hours: 16, days: 2, price: 18999 },
  { id: "three-days", label: "Three Days", hours: 24, days: 3, price: 24999 },
] as const

export const DISTANCE_FROM_BORELLA_OPTIONS = [
  { id: "5km", label: "5 KM" },
  { id: "10km", label: "10 KM" },
  { id: "15km", label: "15 KM" },
  { id: "20km", label: "20 KM" },
  { id: "more", label: "More" },
] as const

export function calculateCost(
  serviceId: string,
  urgencyId: string,
  durationId: string,
  options?: {
    workersNeeded?: number
    needsSupervisor?: boolean
    scheduledDates?: string[]
  },
): number {
  const service = getServiceById(serviceId)
  const duration = DURATION_OPTIONS.find((durationItem) => durationItem.id === durationId)

  if (!service || !duration) return 0

  const workersNeeded = Math.max(1, options?.workersNeeded || 1)
  const isScheduled = urgencyId === "specific-date"
  const scheduledDays = options?.scheduledDates?.length || 0

  const laborCost = isScheduled
    ? 9999 * workersNeeded * Math.max(0, scheduledDays)
    : duration.price * workersNeeded

  const supervisorDays = isScheduled ? scheduledDays : duration.days
  const supervisorCost = options?.needsSupervisor ? supervisorDays * 6000 : 0

  return laborCost + supervisorCost
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
  workersNeeded?: number
  distanceFromBorella?: string
  requesterPhoneSecondary?: string
  scheduledDates?: string[]
  needsSupervisor?: boolean
  attachmentUrls?: string[]
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
