import { type ServiceRequest } from "@/lib/pricing"

export interface RequestDbRow {
  id: string
  tracking_id: string
  requester_name: string
  requester_email: string
  requester_phone: string
  requester_address: string | null
  requester_city: string
  service_id: string
  custom_service_name: string | null
  urgency: string
  scheduled_date: string | null
  duration: string
  other_info: string | null
  payment_method: "card" | "bank-transfer"
  payment_status: "pending" | "initiated" | "paid" | "verified" | "failed" | "cancelled"
  request_status: "pending" | "confirmed" | "worker-assigned" | "in-progress" | "completed" | "cancelled"
  total_cost: number
  currency: string
  payhere_order_id: string | null
  payhere_payment_id: string | null
  payhere_status_code: number | null
  payhere_method: string | null
  receipt_path: string | null
  receipt_uploaded_at: string | null
  source_path: string | null
  client_ip: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export function mapRequestRow(row: RequestDbRow): ServiceRequest {
  return {
    id: row.id,
    trackingId: row.tracking_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone,
    requesterAddress: row.requester_address,
    requesterCity: row.requester_city,
    serviceId: row.service_id,
    customServiceName: row.custom_service_name,
    urgency: row.urgency,
    scheduledDate: row.scheduled_date || undefined,
    duration: row.duration,
    otherInfo: row.other_info || undefined,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    receiptUrl: row.receipt_path || undefined,
    totalCost: Number(row.total_cost),
    status: row.request_status,
    payhereOrderId: row.payhere_order_id,
    payherePaymentId: row.payhere_payment_id,
    payhereStatusCode: row.payhere_status_code,
    sourcePath: row.source_path,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  }
}

export function mapRequestRows(rows: RequestDbRow[]) {
  return rows.map(mapRequestRow)
}
