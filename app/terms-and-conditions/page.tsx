import Link from "next/link"

import { Logo } from "@/components/Logo"

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-foreground">Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground">
          By submitting a request on FixNow, you agree to the terms below.
        </p>

        <section className="space-y-3 rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">1. Request and Scheduling</h2>
          <p className="text-sm text-muted-foreground">
            Your booking details must be accurate. Scheduled jobs can include multiple work dates and each selected date is billed as a full-day service.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">2. Pricing and Payments</h2>
          <p className="text-sm text-muted-foreground">
            Service cost is calculated using selected duration, worker count, and any supervisor add-on. Bank transfer requests require a valid receipt upload.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">3. Attachments</h2>
          <p className="text-sm text-muted-foreground">
            You may upload up to 5 files and each file must be 3MB or less. Only PNG, JPG, and PDF files are accepted.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">4. Service Delivery</h2>
          <p className="text-sm text-muted-foreground">
            Worker assignment and arrival times may vary based on availability and location conditions. FixNow will keep you informed if schedules change.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">5. Cancellations and Refunds</h2>
          <p className="text-sm text-muted-foreground">
            Refund eligibility and cancellation handling are subject to payment method and work status at the time of cancellation.
          </p>
        </section>

        <div>
          <Link href="/" className="text-sm font-medium text-primary underline">
            Back to request form
          </Link>
        </div>
      </main>
    </div>
  )
}
