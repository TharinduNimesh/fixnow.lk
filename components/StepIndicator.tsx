"use client"

import { Check } from "lucide-react"
import { motion } from "framer-motion"

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="mx-auto flex w-full max-w-md items-center justify-center gap-0">
      {steps.map((label, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep

        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted
                    ? "hsl(152, 60%, 36%)"
                    : isCurrent
                      ? "hsl(152, 60%, 36%)"
                      : "hsl(148, 20%, 88%)",
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
              >
                {isCompleted ? (
                  <Check size={16} className="text-primary-foreground" />
                ) : (
                  <span className={isCurrent ? "text-primary-foreground" : "text-muted-foreground"}>
                    {index + 1}
                  </span>
                )}
              </motion.div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  isCurrent
                    ? "text-primary"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
               {index < steps.length - 1 && (
                 <div className="mx-2 -mt-4.5 h-0.5 flex-1">
                <div
                  className={`h-full rounded-full transition-colors ${
                    index < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
