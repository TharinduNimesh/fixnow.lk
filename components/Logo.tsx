import { Wrench } from "lucide-react"

interface LogoProps {
  size?: "sm" | "md" | "lg"
}

export function Logo({ size = "md" }: LogoProps) {
  const sizes = {
    sm: { icon: 18, text: "text-lg" },
    md: { icon: 24, text: "text-2xl" },
    lg: { icon: 32, text: "text-4xl" },
  }

  const selectedSize = sizes[size]

  return (
    <div className="flex items-center gap-2">
      <div className="gradient-primary rounded-lg p-1.5 text-primary-foreground">
        <Wrench size={selectedSize.icon} />
      </div>
      <div>
        <span className={`font-display font-bold tracking-tight ${selectedSize.text} text-foreground`}>
          FIX<span className="text-primary">NOW</span>
        </span>
        {size !== "sm" && (
          <span className="-mt-1 block text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            .LK
          </span>
        )}
      </div>
    </div>
  )
}
