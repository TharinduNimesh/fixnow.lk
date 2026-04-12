import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google"
import { Toaster } from "sonner"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" })
const displayFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        bodyFont.variable,
        displayFont.variable,
        "font-body",
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
