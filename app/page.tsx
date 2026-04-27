"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Upload,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/Logo"
import { ServiceCard } from "@/components/ServiceCard"
import { StepIndicator } from "@/components/StepIndicator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  BANK_INFO,
  calculateCost,
  DISTANCE_FROM_BORELLA_OPTIONS,
  DURATION_OPTIONS,
  getServiceById,
  SERVICES,
  URGENCY_OPTIONS,
} from "@/lib/pricing"

const STEPS = ["Service", "Details", "Payment"]

type PaymentMethod = "" | "card" | "bank-transfer"

type RequestFormState = {
  requesterName: string
  requesterEmail: string
  requesterPhone: string
  requesterPhoneSecondary: string
  requesterAddress: string
  requesterCity: string
  service: string
  customServiceName: string
  workersNeeded: string
  distanceFromBorella: string
  urgency: string
  scheduledDates: string[]
  duration: string
  otherInfo: string
  needsSupervisor: boolean
  termsAccepted: boolean
  attachments: File[]
  paymentMethod: PaymentMethod
  receiptFile: File | null
}

type PayHerePayload = {
  actionUrl: string
  fields: Record<string, string>
}

export default function HomePage() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [trackingId, setTrackingId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scheduleDateInput, setScheduleDateInput] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const MAX_ATTACHMENT_FILE_SIZE = 3 * 1024 * 1024 // 3MB
  const MAX_ATTACHMENT_FILES = 5

  const [form, setForm] = useState<RequestFormState>({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    requesterPhoneSecondary: "",
    requesterAddress: "",
    requesterCity: "",
    service: "",
    customServiceName: "",
    workersNeeded: "",
    distanceFromBorella: "",
    urgency: "",
    scheduledDates: [],
    duration: "",
    otherInfo: "",
    needsSupervisor: false,
    termsAccepted: false,
    attachments: [],
    paymentMethod: "",
    receiptFile: null,
  })

  function getServiceLabel() {
    const selectedService = getServiceById(form.service)
    return form.service === "other"
      ? form.customServiceName || "Other Service"
      : selectedService?.label || "Service"
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File is too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload PNG, JPG, or PDF.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setForm((current) => ({ ...current, receiptFile: file }))
    toast.success(`File "${file.name}" uploaded successfully`)
  }

  function clearReceipt() {
    setForm((current) => ({ ...current, receiptFile: null }))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function addScheduledDate() {
    if (!scheduleDateInput) return

    setForm((current) => {
      if (current.scheduledDates.includes(scheduleDateInput)) {
        toast.error("This date is already selected")
        return current
      }

      return {
        ...current,
        scheduledDates: [...current.scheduledDates, scheduleDateInput].sort(),
      }
    })

    setScheduleDateInput("")
  }

  function removeScheduledDate(date: string) {
    setForm((current) => ({
      ...current,
      scheduledDates: current.scheduledDates.filter((item) => item !== date),
    }))
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || [])
    if (selectedFiles.length === 0) return

    setForm((current) => {
      const availableSlots = MAX_ATTACHMENT_FILES - current.attachments.length
      if (availableSlots <= 0) {
        toast.error(`You can upload up to ${MAX_ATTACHMENT_FILES} files only.`)
        return current
      }

      const nextFiles: File[] = []
      for (const file of selectedFiles.slice(0, availableSlots)) {
        const allowedTypes = ["image/png", "image/jpeg", "application/pdf"]
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name}: only PNG, JPG, or PDF files are allowed.`)
          continue
        }

        if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
          toast.error(`${file.name}: file size must be 3MB or less.`)
          continue
        }

        nextFiles.push(file)
      }

      if (nextFiles.length === 0) return current

      return {
        ...current,
        attachments: [...current.attachments, ...nextFiles],
      }
    })

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = ""
    }
  }

  function removeAttachment(index: number) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function postPayHere(payload: PayHerePayload) {
    const formElement = document.createElement("form")
    formElement.method = "POST"
    formElement.action = payload.actionUrl

    Object.entries(payload.fields).forEach(([name, value]) => {
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = name
      input.value = value
      formElement.appendChild(input)
    })

    document.body.appendChild(formElement)
    formElement.submit()
  }

  const cost = calculateCost(form.service, form.urgency, form.duration, {
    workersNeeded: Number(form.workersNeeded) || 0,
    needsSupervisor: form.needsSupervisor,
    scheduledDates: form.scheduledDates,
  })

  const canProceedStep0 = !!form.service && Number(form.workersNeeded) >= 1
  const canProceedStep1 =
    form.requesterName &&
    form.requesterEmail &&
    form.requesterPhone &&
    form.requesterPhoneSecondary &&
    form.requesterAddress &&
    form.requesterCity &&
    form.distanceFromBorella &&
    form.urgency &&
    (form.urgency === "specific-date" ? form.scheduledDates.length > 0 : !!form.duration) &&
    (form.service !== "other" || form.customServiceName.trim().length > 0) &&
    form.termsAccepted
  const canSubmit =
    !!form.paymentMethod &&
    (form.paymentMethod === "card" || (form.paymentMethod === "bank-transfer" && form.receiptFile))

  const trackingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/track/${trackingId}` : ""

  async function handleSubmit() {
    setIsSubmitting(true)
    const loadingToastId = toast.loading("Processing your request...")

    try {
      const createResponse = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requesterName: form.requesterName,
          requesterEmail: form.requesterEmail,
          requesterPhone: form.requesterPhone,
          requesterPhoneSecondary: form.requesterPhoneSecondary,
          requesterAddress: form.requesterAddress,
          requesterCity: form.requesterCity,
          serviceId: form.service,
          customServiceName: form.customServiceName,
          workersNeeded: Number(form.workersNeeded),
          distanceFromBorella: form.distanceFromBorella,
          urgency: form.urgency,
          scheduledDates: form.scheduledDates,
          duration: form.urgency === "specific-date" ? "full-day" : form.duration,
          otherInfo: form.otherInfo,
          needsSupervisor: form.needsSupervisor,
          termsAccepted: form.termsAccepted,
          paymentMethod: form.paymentMethod,
          sourcePath: window.location.pathname,
        }),
      })

      const createdData = await createResponse.json()

      if (!createResponse.ok) {
        toast.dismiss(loadingToastId)
        throw new Error(createdData?.error || "Failed to save the request")
      }

      setTrackingId(createdData.request.trackingId)

      if (form.attachments.length > 0) {
        const attachmentFormData = new FormData()
        form.attachments.forEach((file) => {
          attachmentFormData.append("attachments", file)
        })

        const attachmentUploadResponse = await fetch(
          `/api/requests/${createdData.request.trackingId}/attachments`,
          {
            method: "POST",
            body: attachmentFormData,
          },
        )

        const attachmentResult = await attachmentUploadResponse.json()
        if (!attachmentUploadResponse.ok) {
          toast.dismiss(loadingToastId)
          throw new Error(attachmentResult?.error || "Failed to upload attachments")
        }
      }
       // Upload receipt for bank-transfer payments
       if (form.paymentMethod === "bank-transfer" && form.receiptFile) {
         toast.dismiss(loadingToastId)
         const uploadToastId = toast.loading("Uploading receipt...")

         const receiptFormData = new FormData()
         receiptFormData.append("receipt", form.receiptFile)

         const uploadResponse = await fetch(`/api/requests/${createdData.request.trackingId}/receipt`, {
           method: "POST",
           body: receiptFormData,
         })

         const uploadResult = await uploadResponse.json()

         if (!uploadResponse.ok) {
           toast.dismiss(uploadToastId)
           throw new Error(uploadResult?.error || "Failed to upload receipt")
         }

         toast.dismiss(uploadToastId)
         toast.success("Receipt uploaded successfully!")
       } else {
         toast.dismiss(loadingToastId)
       }

      if (form.paymentMethod === "card") {
        toast.loading("Redirecting to PayHere payment gateway...")
        const initiateResponse = await fetch("/api/payhere/initiate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trackingId: createdData.request.trackingId }),
        })

        const payHerePayload = (await initiateResponse.json()) as PayHerePayload & { error?: string }

        if (!initiateResponse.ok) {
          toast.dismiss()
          throw new Error(payHerePayload?.error || "Failed to initiate PayHere checkout")
        }

        postPayHere(payHerePayload)
        return
      }

      toast.success("Request submitted successfully!")
      setSubmitted(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit request")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-border px-6 py-4">
          <Logo />
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md space-y-6 text-center"
          >
            <div className="gradient-primary mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <CheckCircle2 size={40} className="text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Request Submitted!</h1>
            <p className="text-muted-foreground">
              Thank you! Your service request has been received. Our team will contact you shortly
              to confirm the details.
            </p>
            <div className="glass space-y-3 rounded-xl p-4">
              <p className="text-sm font-medium text-foreground">Tracking ID</p>
              <p className="font-display text-2xl font-bold text-primary">{trackingId}</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={trackingUrl} className="bg-background text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (trackingUrl) {
                      navigator.clipboard.writeText(trackingUrl)
                    }
                  }}
                >
                  <Copy size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this link to track the progress of your request
              </p>
            </div>
            <Link
              href={`/track/${trackingId}`}
              className="gradient-primary inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold text-primary-foreground"
            >
              Track My Request
            </Link>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo />
        <span className="text-xs font-medium text-muted-foreground">Fast. Reliable. Trusted.</span>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-8">
        <div className="mb-8 w-full">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-6"
            >
              <div className="space-y-2 text-center">
                <h2 className="font-display text-2xl font-bold text-foreground">
                  What service do you need?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select the type of worker you&apos;re looking for
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {SERVICES.map((service) => (
                  <ServiceCard
                    key={service.id}
                    icon={service.icon}
                    label={service.label}
                    selected={form.service === service.id}
                    onClick={() => setForm((current) => ({ ...current, service: service.id }))}
                  />
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workers-needed">How many workers do you need? *</Label>
                <Input
                  id="workers-needed"
                  type="number"
                  min={1}
                  max={50}
                  placeholder="Enter number of workers"
                  value={form.workersNeeded}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, workersNeeded: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">Please enter a number from 1 to 50.</p>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-6"
            >
              <div className="space-y-2 text-center">
                <h2 className="font-display text-2xl font-bold text-foreground">Your Details</h2>
                <p className="text-sm text-muted-foreground">Tell us about your requirements</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter your name"
                      value={form.requesterName}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, requesterName: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mobile">Primary Mobile Number *</Label>
                    <Input
                      id="mobile"
                      placeholder="+94 7X XXXXXXX"
                      value={form.requesterPhone}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, requesterPhone: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile-secondary">Secondary Mobile Number *</Label>
                  <Input
                    id="mobile-secondary"
                    placeholder="+94 7X XXXXXXX"
                    value={form.requesterPhoneSecondary}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, requesterPhoneSecondary: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.requesterEmail}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, requesterEmail: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    placeholder="House / street / road"
                    value={form.requesterAddress}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, requesterAddress: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City / Area *</Label>
                  <Input
                    id="city"
                    placeholder="City or area"
                    value={form.requesterCity}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, requesterCity: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>When do you need this? *</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {URGENCY_OPTIONS.map((urgency) => (
                      <button
                        key={urgency.id}
                        onClick={() => setForm((current) => ({ ...current, urgency: urgency.id }))}
                        className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                          form.urgency === urgency.id
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Clock
                          size={16}
                          className={`mx-auto mb-1 ${
                            form.urgency === urgency.id ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`block text-xs font-medium ${
                            form.urgency === urgency.id ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {urgency.label}
                        </span>
                        {urgency.tag && (
                          <span
                            className={`mt-0.5 block text-[10px] ${
                              form.urgency === urgency.id
                                ? "text-primary/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {urgency.tag}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {form.urgency === "specific-date" && (
                  <div className="space-y-3">
                    <Label htmlFor="date">Select Work Dates * (Full Day - 8 Hours each)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="date"
                        type="date"
                        value={scheduleDateInput}
                        onChange={(event) => setScheduleDateInput(event.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                      <Button type="button" variant="outline" onClick={addScheduledDate}>
                        Add Date
                      </Button>
                    </div>
                    {form.scheduledDates.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Selected dates ({form.scheduledDates.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {form.scheduledDates.map((date) => (
                            <span
                              key={date}
                              className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                            >
                              {date}
                              <button
                                type="button"
                                onClick={() => removeScheduledDate(date)}
                                className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                                aria-label={`Remove ${date}`}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {form.urgency !== "specific-date" ? (
                  <div className="space-y-2">
                    <Label>Work Duration *</Label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {DURATION_OPTIONS.map((duration) => (
                        <button
                          key={duration.id}
                          onClick={() => setForm((current) => ({ ...current, duration: duration.id }))}
                          className={`rounded-xl border-2 p-3 text-center transition-all ${
                            form.duration === duration.id
                              ? "border-primary bg-secondary"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <CalendarDays
                            size={16}
                            className={`mx-auto mb-1 ${
                              form.duration === duration.id ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                          <span
                            className={`block text-xs font-medium ${
                              form.duration === duration.id ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {duration.label}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            LKR {duration.price.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
                    Scheduled work is billed as full-day (8 hours) for each selected date.
                  </div>
                )}

                {cost > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass flex items-center justify-between rounded-xl p-4"
                  >
                    <span className="text-sm font-medium text-foreground">Estimated Cost</span>
                    <span className="font-display text-2xl font-bold text-primary">
                      Rs. {cost.toLocaleString()}
                    </span>
                  </motion.div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="other">Expected Work Done (Optional)</Label>
                  <Textarea
                    id="other"
                    placeholder="Describe what should be completed..."
                    value={form.otherInfo}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, otherInfo: event.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Attachments (Optional)</Label>
                  <div className="space-y-2 rounded-xl border border-border p-4">
                    {form.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {form.attachments.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)}MB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="rounded-md p-1 hover:bg-destructive/15"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X size={16} className="text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No attachments added yet.</p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => attachmentInputRef.current?.click()}
                    >
                      <Upload size={16} className="mr-2" />
                      Upload Files
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Maximum 5 files, each up to 3MB (PNG, JPG, PDF)
                    </p>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf"
                      multiple
                      className="hidden"
                      onChange={handleAttachmentChange}
                      aria-label="Upload attachments"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Distance From Borella *</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {DISTANCE_FROM_BORELLA_OPTIONS.map((distance) => (
                      <button
                        key={distance.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({ ...current, distanceFromBorella: distance.id }))
                        }
                        className={`rounded-xl border-2 p-3 text-center transition-all ${
                          form.distanceFromBorella === distance.id
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span
                          className={`block text-xs font-medium ${
                            form.distanceFromBorella === distance.id ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {distance.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({ ...current, needsSupervisor: !current.needsSupervisor }))
                  }
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                    form.needsSupervisor ? "border-primary bg-secondary" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Do you need a supervisor to monitor work?
                    </p>
                    <p className="text-xs text-muted-foreground">LKR 6,000 per day</p>
                  </div>
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                      form.needsSupervisor ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {form.needsSupervisor ? <Check size={12} /> : null}
                  </span>
                </button>

                <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.termsAccepted}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, termsAccepted: event.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span className="text-muted-foreground">
                    I accept the{" "}
                    <Link href="/terms-and-conditions" target="_blank" className="font-medium text-primary underline">
                      terms and conditions
                    </Link>
                    .
                  </span>
                </label>
                {form.service === "other" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-service">Custom Service Name *</Label>
                    <Input
                      id="custom-service"
                      placeholder="e.g. AC technician, mason, welder"
                      value={form.customServiceName}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, customServiceName: event.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-6"
            >
              <div className="space-y-2 text-center">
                <h2 className="font-display text-2xl font-bold text-foreground">Payment</h2>
                <p className="text-sm text-muted-foreground">Choose your preferred payment method</p>
              </div>

              <div className="glass space-y-3 rounded-xl p-5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-foreground">
                    {getServiceLabel()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Workers</span>
                  <span className="font-medium text-foreground">{form.workersNeeded}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Distance</span>
                  <span className="font-medium text-foreground">
                    {
                      DISTANCE_FROM_BORELLA_OPTIONS.find(
                        (distance) => distance.id === form.distanceFromBorella,
                      )?.label
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Urgency</span>
                  <span className="font-medium text-foreground">
                    {URGENCY_OPTIONS.find((urgency) => urgency.id === form.urgency)?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium text-foreground">
                    {form.urgency === "specific-date"
                      ? `${form.scheduledDates.length} day(s) - Full Day (8 Hours)`
                      : DURATION_OPTIONS.find((duration) => duration.id === form.duration)?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Supervisor</span>
                  <span className="font-medium text-foreground">
                    {form.needsSupervisor ? "Yes (LKR 6,000/day)" : "No"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-display text-2xl font-bold text-primary">
                    Rs. {cost.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setForm((current) => ({ ...current, paymentMethod: "card" }))}
                  className={`space-y-2 rounded-xl border-2 p-5 text-left transition-all ${
                    form.paymentMethod === "card"
                      ? "shadow-glow border-primary bg-secondary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <CreditCard
                    size={24}
                    className={form.paymentMethod === "card" ? "text-primary" : "text-muted-foreground"}
                  />
                  <p
                    className={`font-semibold ${
                      form.paymentMethod === "card" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    Pay by Card
                  </p>
                  <p className="text-xs text-muted-foreground">Visa, Mastercard via PayHere</p>
                </button>
                <button
                  onClick={() =>
                    setForm((current) => ({ ...current, paymentMethod: "bank-transfer" }))
                  }
                  className={`space-y-2 rounded-xl border-2 p-5 text-left transition-all ${
                    form.paymentMethod === "bank-transfer"
                      ? "shadow-glow border-primary bg-secondary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Building2
                    size={24}
                    className={
                      form.paymentMethod === "bank-transfer"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                  <p
                    className={`font-semibold ${
                      form.paymentMethod === "bank-transfer" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    Bank Transfer
                  </p>
                  <p className="text-xs text-muted-foreground">Transfer and upload receipt</p>
                </button>
              </div>

              {form.paymentMethod === "bank-transfer" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4"
                >
                  <div className="space-y-2 rounded-xl bg-secondary p-5">
                    <p className="mb-3 text-sm font-semibold text-foreground">Bank Details</p>
                    {Object.entries(BANK_INFO).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </span>
                        <span className="font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Upload Receipt (Required) *</Label>
                    {form.receiptFile ? (
                      <div className="flex items-center justify-between rounded-xl border-2 border-primary bg-primary/5 p-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{form.receiptFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(form.receiptFile.size / 1024 / 1024).toFixed(2)}MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={clearReceipt}
                          className="ml-2 rounded-lg p-1 hover:bg-destructive/20"
                        >
                          <X size={20} className="text-destructive" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40"
                      >
                        <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload your payment receipt</p>
                        <p className="mt-1 text-xs text-muted-foreground">PNG, JPG or PDF up to 5MB</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      aria-label="Upload payment receipt"
                    />
                  </div>
                </motion.div>
              )}

              {form.paymentMethod === "card" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2 rounded-xl bg-secondary p-6 text-center"
                >
                  <CreditCard size={32} className="mx-auto text-primary" />
                  <p className="text-sm font-medium text-foreground">PayHere Payment Gateway</p>
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll be redirected to PayHere to complete payment securely.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Final payment confirmation is received via secure server callback.
                  </p>
                </motion.div>
              )}


            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex w-full gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((current) => current - 1)} className="h-12 flex-1">
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
              onClick={() => setStep((current) => current + 1)}
              className="gradient-primary h-12 flex-1 font-semibold text-primary-foreground"
            >
              Continue <ArrowRight size={16} className="ml-2" />
            </Button>
          ) : (
            <Button
              disabled={!canSubmit || isSubmitting}
              onClick={handleSubmit}
              className="gradient-primary h-12 flex-1 font-semibold text-primary-foreground"
            >
              {isSubmitting ? (
                "Submitting..."
              ) : (
                <>
                  Submit Request <ArrowRight size={16} className="ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
