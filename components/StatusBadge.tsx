import { STATUS_CONFIG, type RequestStatus } from "@/lib/pricing"

interface StatusBadgeProps {
  status: RequestStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  const colorMap: Record<string, string> = {
    warning: "border-warning/30 bg-warning/15 text-warning-foreground",
    info: "border-info/30 bg-info/15 text-info",
    primary: "border-primary/30 bg-primary/15 text-primary",
    success: "border-success/30 bg-success/15 text-success",
    destructive: "border-destructive/30 bg-destructive/15 text-destructive",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        colorMap[config.color] || colorMap.primary
      }`}
    >
      {config.label}
    </span>
  )
}
