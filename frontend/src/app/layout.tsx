import type { Metadata } from "next"
import { Source_Code_Pro, Source_Sans_3 } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/lib/auth"
import "./globals.css"

// Streamlit's default typefaces, so the new UI reads the same as the old one.
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
})

const sourceCode = Source_Code_Pro({
  variable: "--font-source-code",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: { default: "HireCheck", template: "%s · HireCheck" },
  description: "AI-powered resume screening: upload resumes, score them against a job description, and review explainable decisions.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${sourceCode.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
        <Toaster theme="light" position="top-right" />
      </body>
    </html>
  )
}
