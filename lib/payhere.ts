import crypto from "node:crypto"

import { splitName } from "@/lib/request-validation"
import { type ServiceRequest } from "@/lib/pricing"

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function md5(value: string) {
  return crypto.createHash("md5").update(value, "utf8").digest("hex").toUpperCase()
}

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replaceAll(",", "")
}

export function buildPayHerePayload(request: ServiceRequest) {
  const merchantId = getRequiredEnv("PAYHERE_MERCHANT_ID")
  const merchantSecret = getRequiredEnv("PAYHERE_MERCHANT_SECRET")
  const appUrl = getRequiredEnv("APP_URL")
  const currency = "LKR"
  const orderId = request.payhereOrderId || request.trackingId
  const amount = formatAmount(request.totalCost)
  const hashedSecret = md5(merchantSecret)
  const hash = md5(`${merchantId}${orderId}${amount}${currency}${hashedSecret}`)
  const { firstName, lastName } = splitName(request.requesterName)

  return {
    actionUrl:
      process.env.PAYHERE_ENV === "live"
        ? "https://www.payhere.lk/pay/checkout"
        : "https://sandbox.payhere.lk/pay/checkout",
    fields: {
      merchant_id: merchantId,
      return_url: `${appUrl}/payment/return?tracking_id=${encodeURIComponent(request.trackingId)}`,
      cancel_url: `${appUrl}/payment/cancel?tracking_id=${encodeURIComponent(request.trackingId)}`,
      notify_url: `${appUrl}/api/payhere/notify`,
      first_name: firstName,
      last_name: lastName,
      email: request.requesterEmail || "customer@example.com",
      phone: request.requesterPhone,
      address: request.requesterAddress || request.requesterCity,
      city: request.requesterCity,
      country: "Sri Lanka",
      order_id: orderId,
      items: request.customServiceName || request.serviceId,
      currency,
      amount,
      hash,
      custom_1: request.trackingId,
      custom_2: request.id,
    },
  }
}

export function verifyPayHereCallback(params: {
  merchant_id: string
  order_id: string
  payhere_amount: string
  payhere_currency: string
  status_code: string
  md5sig: string
}) {
  const merchantSecret = getRequiredEnv("PAYHERE_MERCHANT_SECRET")
  const localMd5sig = md5(
    `${params.merchant_id}${params.order_id}${params.payhere_amount}${params.payhere_currency}${params.status_code}${md5(merchantSecret)}`,
  )

  return localMd5sig === params.md5sig.toUpperCase()
}
