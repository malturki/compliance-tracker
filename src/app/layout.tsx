import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono, Geist } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'
import { Toaster } from 'sonner'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Compliance Tracker — Pi Squared Inc.',
  description: 'Track compliance obligations, deadlines, and completions.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(jetbrainsMono.variable, "font-sans", geist.variable)}>
      <body className="bg-[#0a0e1a] text-slate-200 font-sans antialiased">
        <AppShell>{children}</AppShell>
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  )
}
