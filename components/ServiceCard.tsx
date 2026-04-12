"use client"

import { motion } from "framer-motion"

interface ServiceCardProps {
  icon: string
  label: string
  selected: boolean
  onClick: () => void
}

export function ServiceCard({ icon, label, selected, onClick }: ServiceCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 ${
        selected
          ? "shadow-glow border-primary bg-secondary"
          : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50"
      }`}
    >
      <span className="text-3xl">{icon}</span>
      <span className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>
        {label}
      </span>
      {selected && (
        <motion.div
          layoutId="service-check"
          className="gradient-primary absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full"
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      )}
    </motion.button>
  )
}
