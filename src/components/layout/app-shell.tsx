import { Sidebar } from './sidebar'
import { LastSyncBadge } from './last-sync-badge'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F6F8FA]">
      <Sidebar />
      {/* On mobile the sidebar is off-screen (drawer) and the main pane fills
          the viewport; the hamburger inside Sidebar overlays at top-left.
          From lg upward the sidebar is permanently visible and main is
          offset by its 16rem width. */}
      {/* `min-w-0` lets flex-1 actually shrink below children's intrinsic
          width; otherwise a wide child (e.g. a table) forces main wider than
          the viewport and produces phantom horizontal scroll on mobile. */}
      <main className="flex-1 min-w-0 lg:ml-64 bg-[#F6F8FA] min-h-screen pt-12 lg:pt-0">
        {children}
      </main>
      {/* "Synced N ago" badge — fixed top-right, visible on every page.
          Hidden on mobile (<sm) so the hamburger area stays uncrowded. */}
      <LastSyncBadge />
    </div>
  )
}
