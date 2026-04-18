import { Sidebar } from './sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F6F8FA]">
      <Sidebar />
      {/* On mobile the sidebar is off-screen (drawer) and the main pane fills
          the viewport; the hamburger inside Sidebar overlays at top-left.
          From lg upward the sidebar is permanently visible and main is
          offset by its 16rem width. */}
      <main className="flex-1 lg:ml-64 bg-[#F6F8FA] min-h-screen pt-12 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
