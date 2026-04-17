import { Sidebar } from './sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F6F8FA]">
      <Sidebar />
      <main className="flex-1 ml-64 bg-[#F6F8FA] min-h-screen">
        {children}
      </main>
    </div>
  )
}
