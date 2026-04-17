import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { AppShell } from '@/components/layout/app-shell'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help'
import { Toaster } from 'sonner'

const generalSans = localFont({
  src: [
    { path: '../../public/fonts/GeneralSans-Variable.woff2', weight: '200 700', style: 'normal' },
    { path: '../../public/fonts/GeneralSans-VariableItalic.woff2', weight: '200 700', style: 'italic' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FAST Compliance Tracker',
  description: 'Track compliance obligations, deadlines, and completions.',
  icons: { icon: '/icon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={generalSans.variable}>
      <body className="bg-[#F6F8FA] text-[#2B2C2F] font-sans antialiased">
        <SessionProvider>
          <AppShell>{children}</AppShell>
          <CommandPalette />
          <KeyboardShortcutsHelp />
          <Toaster position="bottom-right" theme="light" />
        </SessionProvider>
      </body>
    </html>
  )
}
