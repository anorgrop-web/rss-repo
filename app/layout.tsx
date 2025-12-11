import type React from "react"
import type { Metadata } from "next"
import { Suspense } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { FacebookPixel } from "@/components/facebook-pixel"
import { GoogleAnalytics } from "@next/third-parties/google"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

// Updated metadata for checkout page
export const metadata: Metadata = {
  title: "Checkout - Katuchef",
  description: "Finalize sua compra de tábuas de titânio Katuchef",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`font-sans antialiased`}>
        <Suspense fallback={null}>
          <FacebookPixel />
        </Suspense>
        <GoogleAnalytics gaId="G-YKD5QZVEHQ" />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
