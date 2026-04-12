# PayHere Integration Guide

## Overview

Our fixnow.lk application integrates with PayHere (Sri Lanka's payment gateway) to process card payments securely. This document explains the complete payment flow, how the server callback works, and how users are redirected.

## Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  1. User fills form → POST /api/requests                                   │
│     ├─ Server calculates price (NOT from frontend)                         │
│     ├─ Stores in Supabase with payment_status: "pending"                   │
│     ├─ Returns: trackingId + nextAction: "payhere"                         │
│     └─ Event logged to request_events table                                │
│                                                                             │
│  2. Frontend calls POST /api/payhere/initiate                              │
│     ├─ Server fetches request from DB                                      │
│     ├─ Generates MD5 hash with signature (merchant_secret)                 │
│     ├─ Updates payment_status: "initiated"                                 │
│     └─ Returns PayHere form payload (fields + actionUrl)                   │
│                                                                             │
│  3. Frontend programmatically POSTs to PayHere                             │
│     ├─ HTML form with hidden fields generated                              │
│     ├─ Form.submit() redirects user to PayHere checkout                    │
│     └─ User enters card details securely on PayHere                        │
│                                                                             │
│  4. PayHere processes payment (2 parallel callbacks)                       │
│     │                                                                       │
│     ├─ Callback A: Server-to-Server (notify_url)                          │
│     │  ├─ PayHere POSTs to: /api/payhere/notify (secure server endpoint)  │
│     │  ├─ Contains: status_code (2/0/-1/-2/-3), md5sig, order_id, amount  │
│     │  ├─ Our server verifies MD5 signature                                │
│     │  ├─ Validates amount matches DB record                               │
│     │  ├─ Updates request in Supabase                                       │
│     │  ├─ Logs event to request_events                                      │
│     │  └─ Returns: 200 "OK" (PayHere doesn't retry if 200)                │
│     │                                                                       │
│     └─ Callback B: Browser Redirect (return_url)                          │
│        ├─ User redirected to: /payment/return?tracking_id=FN-XXXXXX      │
│        ├─ Browser page fetches request status from /api/requests/[id]    │
│        ├─ Shows status based on what notify_url updated in DB             │
│        └─ User sees: "Payment Verified!" or "Payment Failed"              │
│                                                                             │
│  5. User can track request                                                 │
│     ├─ Copy tracking URL from success page                                 │
│     ├─ Navigate to /track/[trackingId]                                    │
│     ├─ Request status updated by notify_url callback                      │
│     └─ Real-time status display                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Critical Concept: notify_url vs return_url

### ❌ Common Misconception
Many developers think **return_url** is where they get payment status. It's NOT!

```
return_url = Only for browser redirect back to the site
           = Does NOT contain payment data
           = Is only for UX to tell user "payment attempt finished"
```

### ✅ Correct Understanding
**notify_url** is where the payment status actually comes from:

```
notify_url = Server-to-Server callback (PayHere → Our Backend)
           = Happens BEFORE user browser redirect
           = Includes payment status_code, signature, amount
           = Our server updates database with result
           = MUST be publicly accessible (not localhost)
```

## Current Implementation Status

### URL Configuration (in .env)
```env
APP_URL=http://localhost:3000  # Used to build URLs for PayHere
PAYHERE_ENV=sandbox             # Use "sandbox" for testing, "live" for production
```

### Payment URLs Used

1. **return_url** (After payment, redirects browser back to us)
   ```
   {{ APP_URL }}/payment/return?tracking_id={{ trackingId }}
   ```
   - Page loads and fetches request status from API
   - Shows user: "Payment Verified!" or "Payment Failed"
   - User can copy tracking URL to track progress

2. **cancel_url** (When user cancels payment)
   ```
   {{ APP_URL }}/payment/cancel?tracking_id={{ trackingId }}
   ```
   - Page loads and fetches request status from API
   - Shows user: "Payment Cancelled"
   - Allows user to try again

3. **notify_url** (PayHere calls our server)
   ```
   {{ APP_URL }}/api/payhere/notify
   ```
   - Server endpoint receives POST from PayHere
   - Verifies MD5 signature
   - Validates amount matches database
   - Updates payment_status and request_status
   - Logs event for audit trail

## Payment Status Codes

PayHere sends these `status_code` values in the notify_url callback:

```
status_code: 2   →  ✅ SUCCESS       (payment_status: "verified", request_status: "confirmed")
status_code: 0   →  ⏳ PENDING        (payment_status: "pending", request_status: "pending")
status_code: -1  →  ❌ CANCELLED     (payment_status: "cancelled", request_status: "cancelled")
status_code: -2  →  ❌ FAILED        (payment_status: "failed", request_status: "pending")
status_code: -3  →  ⚠️  CHARGEDBACK  (payment_status: "failed", request_status: "cancelled")
```

## Security Measures

### 1. MD5 Signature Verification (Both Directions)

**When initiating payment (client → PayHere):**
```typescript
// Only server-side (never on frontend!)
const hash = md5(
  merchantId + orderId + amount + currency + md5(merchantSecret)
)
// PayHere verifies this hash
```

**When receiving notification (PayHere → server):**
```typescript
// Calculate expected signature locally
const expectedSignature = md5(
  merchantId + orderId + amount + currency + statusCode + md5(merchantSecret)
)
// Verify against md5sig sent by PayHere
if (expectedSignature !== payhereMd5sig) {
  return 403 Unauthorized  // Reject forged notification
}
```

### 2. Amount Validation
When notify_url is called, we verify:
```typescript
const storedAmount = request.total_cost  // From database
const callbackAmount = form.payhere_amount  // From PayHere

if (storedAmount !== callbackAmount) {
  // Log as potential fraud
  // Reject payment
  return 403 Forbidden
}
```

This ensures no man-in-the-middle can change the amount.

### 3. Server-Side Price Calculation
```typescript
// Frontend shows estimate only (for UX)
const estimatePrice = calculateCost(serviceId, urgency, duration)

// Backend recalculates independently (authoritative)
const authorityPrice = calculateCost(input.serviceId, input.urgency, input.duration)

// Never trust client-provided price
// Frontend never sends price to backend
```

## Code Files

### Frontend Files

**[app/page.tsx](../app/page.tsx)** - Request Form
- ✅ Step 0: Service selection
- ✅ Step 1: Customer details + urgency + duration
- ✅ Step 2: Payment method selection
  - Card (PayHere) → immediately POSTs to PayHere
  - Bank Transfer → requires receipt upload (5MB limit, PNG/JPG/PDF)
- Button disabled until file uploaded for bank-transfer
- Shows estimated cost (frontend-calculated, for preview only)
- Toast notifications for errors

**[app/payment/return/page.tsx](../app/payment/return/page.tsx)** - Success Landing
- Fetches request status from `/api/requests/[trackingId]`
- Shows status: "Payment Verified!" or "Payment Failed" or loading
- User can copy tracking URL: `{{ APP_URL }}/track/{{ trackingId }}`
- Links to tracking page to see request progress

**[app/payment/cancel/page.tsx](../app/payment/cancel/page.tsx)** - Cancellation Landing
- Fetches request status from `/api/requests/[trackingId]`
- Informs user payment was cancelled
- Allows retry or starting over

### Backend Files

**[app/api/requests/route.ts](../app/api/requests/route.ts)** - Request Creation
- POST creates new service request
- ✅ Server-side price calculation: `totalCost = calculateCost(serviceId, urgency, duration)`
- ✅ Never trusts frontend price
- Stores in Supabase: `total_cost`, `payment_status: "pending"`
- Logs event: `request_created`
- Returns: `{ request, nextAction: "payhere" | "bank-transfer" }`

**[app/api/payhere/initiate/route.ts](../app/api/payhere/initiate/route.ts)** - Checkout Initialization
- POST with tracking ID
- Fetches request from database
- Updates: `payment_status: "initiated"`
- Calls `buildPayHerePayload(request)` to get form fields
- Returns PayHere form fields + `actionUrl` for frontend to POST to

**[app/api/payhere/notify/route.ts](../app/api/payhere/notify/route.ts)** - Payment Notification (Critical!)
- Receives server-to-server callback from PayHere (not browser-based)
- ✅ Verifies MD5 signature using `verifyPayHereCallback()`
- ✅ Validates amount: `storedAmount === callbackAmount`
- Maps status_code → payment_status + request_status
- Updates request in Supabase
- Logs event: `payhere_notification` with full payload
- Returns: 200 "OK" to PayHere (prevents retries)

**[lib/payhere.ts](../lib/payhere.ts)** - PayHere Utilities
- `buildPayHerePayload(request)`:
  - Constructs form fields for POST to PayHere
  - Generates MD5 hash with merchant_secret
  - Includes tracking ID in custom_1 and custom_2 fields
  - Returns: `{ actionUrl, fields }`

- `verifyPayHereCallback(params)`:
  - Verifies MD5 signature from PayHere notification
  - Ensures notification is from PayHere, not forged
  - Returns: boolean

## Testing Checklist

### Development (Sandbox Mode)

1. **Set environment variables:**
   ```
   PAYHERE_ENV=sandbox
   PAYHERE_MERCHANT_ID=<your-sandbox-merchant-id>
   PAYHERE_MERCHANT_SECRET=<your-sandbox-secret>
   ```

2. **Test payment success flow:**
   - Fill form → Select "Card" payment → Click submit
   - Redirected to PayHere sandbox checkout
   - Use test card: 4111 1111 1111 1111 (Visa test)
   - Any future expiry date, any CVV
   - Should redirect to `/payment/return?tracking_id=FN-XXXXXX`
   - Page should fetch and show "Payment Verified!"

3. **Test payment cancellation:**
   - Fill form → Select "Card" → Click submit
   - On PayHere page, click Cancel
   - Should redirect to `/payment/cancel?tracking_id=FN-XXXXXX`
   - Page should show "Payment Cancelled"

4. **Test database updates:**
   - Use Supabase Dashboard or `prisma studio`
   - Check service_requests table
   - Verify: `payment_status: "verified"`, `request_status: "confirmed"` after success
   - Check request_events table for: `payhere_initiated`, `payhere_notification`

5. **Test amount validation:**
   - Modify browser network request to /api/requests to send wrong amount
   - Check database: should be stored with incorrect amount
   - Check notify_url response: should reject with 403 if PayHere reports different amount
   - Check request_events: should have `payhere_amount_mismatch` event

### Production (Live Mode)

1. **Update environment:**
   ```
   PAYHERE_ENV=live
   PAYHERE_MERCHANT_ID=<your-live-merchant-id>
   PAYHERE_MERCHANT_SECRET=<your-live-secret>
   APP_URL=https://fixnow.lk  # Must be publicly accessible
   ```

2. **Verify notify_url:**
   - PayHere must be able to reach your `APP_URL/api/payhere/notify`
   - Cannot be localhost or behind private VPN
   - Must have valid SSL certificate (HTTPS)
   - Server must be publicly DNS-resolvable

3. **Test with real payment:**
   - Process small transaction with real card
   - Verify payment appears in PayHere dashboard
   - Verify database updates correctly
   - Verify user sees correct status on return page
   - Verify user can track request

## Troubleshooting

### Payment redirects but status not updating

**Cause:** notify_url callback is not being called or is failing silently

**Solutions:**
1. Check server logs for requests to `/api/payhere/notify`
2. Verify `APP_URL` is publicly accessible (not localhost)
3. Verify firewall allows HTTPS traffic on port 443
4. Check PayHere merchant dashboard for "Failed Notifications"
5. Ensure `PAYHERE_MERCHANT_SECRET` matches what's in PayHere settings

### "Invalid PayHere signature" error

**Cause:** MD5 hash verification failed

**Solutions:**
1. Verify `PAYHERE_MERCHANT_SECRET` is correct and exact match
2. Check amount value formatting (should not have commas)
3. Verify merchant_id is correct
4. Check order_id matches (should be tracking ID)

### Amount mismatch detected

**Cause:** Database amount different from PayHere callback amount

**Solutions:**
1. Check database record: `total_cost` value
2. Check PayHere notification: `payhere_amount` value
3. Verify `calculateCost()` logic is consistent
4. Check for floating-point precision issues
5. Review request_events table for `payhere_amount_mismatch` entries

### User stuck on return page (infinite loading)

**Cause:** `/api/requests/[trackingId]` endpoint failing

**Solutions:**
1. Check endpoint is deployed
2. Verify Supabase connection is working
3. Check Supabase RLS policies (should deny anonymous for this table)
4. Verify tracking ID is valid format: `FN-XXXXXX`

## File Upload (Bank Transfer)

For bank transfer payment method:
- User must upload receipt (PNG, JPG, or PDF)
- Maximum file size: **5MB**
- Submit button disabled until file is selected
- Toast notifications on upload
  - ✅ Success: "File 'receipt.pdf' uploaded successfully"
  - ❌ Too large: "File is too large. Maximum size is 5MB"
  - ❌ Invalid type: "Invalid file type. Please upload PNG, JPG, or PDF"

Future implementation: Receipts stored in Supabase Storage bucket `request-receipts/{tracking_id}/{file_id}` with signed URLs and private access.

## Key Takeaways

1. **notify_url is the source of truth** - This is server-to-server callback, happens before browser redirect
2. **return_url is just for UX** - Use it to let user know "payment happened", but fetch actual status from database
3. **Never trust client price** - Always recalculate on server before charging
4. **Always verify signatures** - Check MD5 hash to ensure PayHere genuinely sent the notification
5. **Always validate amounts** - Check callback amount matches what's in database
6. **Publicly accessible URL required** - notify_url must be reachable from PayHere servers (not localhost)
