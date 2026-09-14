import type { Metadata } from "next"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  metadataBase: new URL("https://smartbin.maxkabechani.dev"),
  title: { default: "SmartBin Connect", template: "%s · SmartBin Connect" },
  description: "Monitor connected smart bins, predict collection needs, and coordinate efficient waste pickup with SmartBin Connect.",
  applicationName: "SmartBin Connect",
  keywords: ["smart bin", "IoT waste management", "ESP32", "AI waste collection", "smart city"],
  authors: [{ name: "SmartBin Connect" }],
  creator: "SmartBin Connect",
  publisher: "SmartBin Connect",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://smartbin.maxkabechani.dev",
    siteName: "SmartBin Connect",
    title: "SmartBin Connect · Smarter waste operations",
    description: "Monitor bin capacity and coordinate AI-prioritized collection routes from one calm operations dashboard.",
  },
  twitter: {
    card: "summary",
    title: "SmartBin Connect · Smarter waste operations",
    description: "Monitor bin capacity and coordinate AI-prioritized collection routes.",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers><TooltipProvider>{children}</TooltipProvider></Providers></body></html>
}
