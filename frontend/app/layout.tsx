import type { Metadata } from "next"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "SmartBin Connect",
  description: "AI-powered smart waste management operations dashboard",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><TooltipProvider>{children}</TooltipProvider></body></html>
}
