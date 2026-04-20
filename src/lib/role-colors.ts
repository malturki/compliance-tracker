/**
 * Canonical role-badge color classes. Used by the sidebar, help topics,
 * and Settings pages. Keep a single source of truth so tuning the FAST
 * accent tint happens in one place.
 */
import type { Role } from './types'

export type { Role }

export const ROLE_BADGE_CLASSES: Record<Role, string> = {
  admin: 'text-graphite bg-light-steel/[0.28] border-light-steel',
  editor: 'text-graphite bg-silicon/50 border-silicon',
  viewer: 'text-steel bg-silicon/30 border-silicon',
}
