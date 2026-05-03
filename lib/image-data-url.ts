const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

const MAX_BYTES = 2 * 1024 * 1024

export type FileReadProgress = (percent: number | null) => void

/** 将图片文件转为 data URL，写入 logo_url / screenshot_url */
export async function fileToImageDataUrl(
  file: File,
  options?: { onProgress?: FileReadProgress },
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new Error('不支持的文件类型')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('文件大小不能超过2MB')
  }
  const onProgress = options?.onProgress
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadstart = () => onProgress?.(0)
    reader.onprogress = (e) => {
      if (!onProgress) return
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((100 * e.loaded) / e.total)))
      } else {
        onProgress(null)
      }
    }
    reader.onload = () => {
      onProgress?.(100)
      const s = reader.result
      if (typeof s !== 'string') {
        reject(new Error('读取失败'))
        return
      }
      resolve(s)
    }
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 文本文件读取进度（如批量导入 JSON） */
export async function readFileAsTextWithProgress(
  file: File,
  options?: { onProgress?: FileReadProgress },
): Promise<string> {
  const onProgress = options?.onProgress
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadstart = () => onProgress?.(0)
    reader.onprogress = (e) => {
      if (!onProgress) return
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((100 * e.loaded) / e.total)))
      } else {
        onProgress(null)
      }
    }
    reader.onload = () => {
      onProgress?.(100)
      const s = reader.result
      if (typeof s !== 'string') {
        reject(new Error('读取失败'))
        return
      }
      resolve(s)
    }
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsText(file, 'utf-8')
  })
}
