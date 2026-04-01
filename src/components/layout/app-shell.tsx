import { Sidebar } from './sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0e1a]">
      <Sidebar />
      <main className="flex-1 ml-64 bg-[#0a0e1a] min-h-screen">
        {children}
      </main>
    </div>
  )
}
