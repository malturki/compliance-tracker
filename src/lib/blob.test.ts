import { describe, it, expect } from 'vitest'
import { validateFile } from './blob'

// Minimal File-like factory that satisfies the fields validateFile reads.
// Using a real `File` would require the node/undici runtime — this is a
// pure static-check function so duck-typed fakes are fine.
function fakeFile(name: string, type: string, sizeBytes: number): File {
  const f = new File([new Uint8Array(Math.min(sizeBytes, 1024))], name, { type })
  // Override size so we can simulate large files cheaply.
  Object.defineProperty(f, 'size', { value: sizeBytes, writable: false })
  return f
}

describe('validateFile', () => {
  it('accepts a PDF under the default 25 MB cap', () => {
    const file = fakeFile('report.pdf', 'application/pdf', 5 * 1024 * 1024)
    expect(validateFile(file)).toEqual({ valid: true })
  })

  it('rejects files larger than the default 25 MB cap', () => {
    const file = fakeFile('big.pdf', 'application/pdf', 30 * 1024 * 1024)
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/25MB/)
  })

  it('honors a custom size cap', () => {
    const file = fakeFile('mid.pdf', 'application/pdf', 8 * 1024 * 1024)
    const result = validateFile(file, 5)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/5MB/)
  })

  it('accepts all supported image types', () => {
    for (const type of ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']) {
      expect(validateFile(fakeFile('x.img', type, 1000)).valid).toBe(true)
    }
  })

  it('accepts office document MIME types', () => {
    const types = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    for (const type of types) {
      expect(validateFile(fakeFile('x.doc', type, 1000)).valid).toBe(true)
    }
  })

  it('accepts text/plain', () => {
    expect(validateFile(fakeFile('notes.txt', 'text/plain', 500)).valid).toBe(true)
  })

  it('rejects unsupported MIME types', () => {
    const file = fakeFile('script.sh', 'application/x-sh', 200)
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/not supported/i)
  })

  it('rejects videos and binaries by default', () => {
    expect(validateFile(fakeFile('clip.mp4', 'video/mp4', 1000)).valid).toBe(false)
    expect(validateFile(fakeFile('exe', 'application/octet-stream', 1000)).valid).toBe(false)
  })
})
