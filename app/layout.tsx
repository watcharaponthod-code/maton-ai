import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/ui/Sidebar"

export const metadata: Metadata = {
  title: "MATON AI — Scientific Assistant",
  description: "Multimodal Scientific AI Assistant — RAG, protein analysis, autonomous agents",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  )
}
