'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from './button'

interface FileUploadProps {
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
  maxSizeMB?: number
  accept?: string
}

export function FileUpload({
  files,
  onChange,
  maxFiles = 5,
  maxSizeMB = 10,
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt',
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const validateAndAddFiles = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return

    const fileArray = Array.from(newFiles)
    setError(null)

    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    const maxBytes = maxSizeMB * 1024 * 1024
    const oversized = fileArray.find((f) => f.size > maxBytes)
    if (oversized) {
      setError(`File too large: ${oversized.name} (max ${maxSizeMB}MB)`)
      return
    }

    onChange([...files, ...fileArray])
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    validateAndAddFiles(e.dataTransfer.files)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndAddFiles(e.target.files)
  }

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
    setError(null)
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4 text-blue-400" />
    }
    return <FileText className="w-4 h-4 text-slate-400" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer
          ${
            dragActive
              ? 'border-amber-500 bg-amber-950/20'
              : 'border-[#1e2d47] hover:border-[#2e3d57] bg-[#0a0e1a]'
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <Upload className="w-8 h-8 text-slate-500" />
          <div className="text-xs text-slate-400">
            <span className="font-medium text-slate-300">Click to upload</span>{' '}
            or drag and drop
          </div>
          <div className="text-[10px] text-slate-600">
            PDF, images, or documents (max {maxSizeMB}MB, {maxFiles} files)
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded px-2 py-1">
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-[#0a0e1a] border border-[#1e2d47] rounded px-2.5 py-2 text-xs"
            >
              {getFileIcon(file)}
              <div className="flex-1 min-w-0">
                <div className="text-slate-300 truncate">{file.name}</div>
                <div className="text-slate-600 text-[10px]">
                  {formatFileSize(file.size)}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
                className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 hover:bg-red-950/20"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
