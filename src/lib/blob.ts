import { put, del, list } from '@vercel/blob'

/**
 * Upload a file to Vercel Blob Storage
 */
export async function uploadToBlob(
  file: File,
  filename?: string
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  }

  const blob = await put(filename || file.name, file, {
    access: 'public',
    token,
  })

  return blob.url
}

/**
 * Delete a file from Vercel Blob Storage
 */
export async function deleteFromBlob(url: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  }

  await del(url, { token })
}

/**
 * List all blobs (for cleanup/management)
 */
export async function listBlobs() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  }

  return await list({ token })
}

/**
 * Validate file size and type before upload
 */
export function validateFile(
  file: File,
  maxSizeMB: number = 10
): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMB * 1024 * 1024

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File too large (max ${maxSizeMB}MB)`,
    }
  }

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'File type not supported (PDF, images, or common documents only)',
    }
  }

  return { valid: true }
}
