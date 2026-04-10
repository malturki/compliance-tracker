import { describe, it, expect, vi } from 'vitest'

vi.mock('./auth', () => ({ auth: vi.fn() }))

import { checkRole, ForbiddenError } from './auth-helpers'

describe('checkRole', () => {
  it('allows admin for any role requirement', () => {
    expect(() => checkRole('admin', 'viewer')).not.toThrow()
    expect(() => checkRole('admin', 'editor')).not.toThrow()
    expect(() => checkRole('admin', 'admin')).not.toThrow()
  })

  it('allows editor for viewer and editor requirements', () => {
    expect(() => checkRole('editor', 'viewer')).not.toThrow()
    expect(() => checkRole('editor', 'editor')).not.toThrow()
  })

  it('rejects editor for admin requirement', () => {
    expect(() => checkRole('editor', 'admin')).toThrow(ForbiddenError)
  })

  it('allows viewer only for viewer requirement', () => {
    expect(() => checkRole('viewer', 'viewer')).not.toThrow()
  })

  it('rejects viewer for editor requirement', () => {
    expect(() => checkRole('viewer', 'editor')).toThrow(ForbiddenError)
  })

  it('rejects viewer for admin requirement', () => {
    expect(() => checkRole('viewer', 'admin')).toThrow(ForbiddenError)
  })
})
