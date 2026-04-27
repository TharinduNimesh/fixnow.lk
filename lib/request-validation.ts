import { z } from "zod"

import { DISTANCE_FROM_BORELLA_OPTIONS, DURATION_OPTIONS, SERVICES, URGENCY_OPTIONS } from "@/lib/pricing"

const serviceIds = SERVICES.map((service) => service.id) as [string, ...string[]]
const urgencyIds = URGENCY_OPTIONS.map((urgency) => urgency.id) as [string, ...string[]]
const durationIds = DURATION_OPTIONS.map((duration) => duration.id) as [string, ...string[]]
const distanceIds = DISTANCE_FROM_BORELLA_OPTIONS.map((distance) => distance.id) as [string, ...string[]]

export const requestCreateSchema = z
  .object({
    requesterName: z.string().trim().min(2).max(120),
    requesterEmail: z.string().trim().email(),
    requesterPhone: z.string().trim().min(7).max(32),
    requesterPhoneSecondary: z.string().trim().min(7).max(32),
    requesterAddress: z.string().trim().min(3).max(255),
    requesterCity: z.string().trim().min(2).max(120),
    serviceId: z.enum(serviceIds),
    customServiceName: z.string().trim().max(120).optional().or(z.literal("")),
    workersNeeded: z.coerce.number().int().min(1).max(50),
    distanceFromBorella: z.enum(distanceIds),
    urgency: z.enum(urgencyIds),
    scheduledDate: z.string().optional().or(z.literal("")),
    scheduledDates: z.array(z.string().trim().min(1)).max(31).optional(),
    duration: z.enum(durationIds).optional(),
    otherInfo: z.string().trim().max(2000).optional().or(z.literal("")),
    needsSupervisor: z.boolean().optional(),
    termsAccepted: z.literal(true),
    paymentMethod: z.enum(["card", "bank-transfer"]),
    sourcePath: z.string().trim().max(255).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.serviceId === "other" && !value.customServiceName?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customServiceName"],
        message: "Custom service name is required when selecting Other Service.",
      })
    }

    if (value.urgency === "specific-date" && !(value.scheduledDates && value.scheduledDates.length > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledDates"],
        message: "Please choose at least one schedule date.",
      })
    }

    if (value.urgency !== "specific-date" && !value.duration) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration"],
        message: "Please choose a work duration.",
      })
    }
  })

export const requestUpdateSchema = z.object({
  requestStatus: z.enum([
    "pending",
    "confirmed",
    "worker-assigned",
    "in-progress",
    "completed",
    "cancelled",
  ]),
  paymentStatus: z.enum(["pending", "initiated", "paid", "verified", "failed", "cancelled"]),
})

export const payhereInitiateSchema = z.object({
  trackingId: z.string().trim().min(4).max(40),
})

export type RequestCreateInput = z.infer<typeof requestCreateSchema>
export type PayHereInitiateInput = z.infer<typeof payhereInitiateSchema>

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  const firstName = parts[0] || "Customer"
  const lastName = parts.slice(1).join(" ") || "User"

  return { firstName, lastName }
}

export function normalizeOptionalText(value: string | undefined | null) {
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeNullableString(value: string | undefined | null) {
  const normalized = normalizeOptionalText(value)
  return normalized ?? null
}
