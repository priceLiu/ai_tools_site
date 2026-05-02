const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

const MAX_BYTES = 2 * 1024 * 1024

/** 将图片文件转为 data URL，写入 logo_url / screenshot_url */
export async function fileToImageDataUrl(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new Error('不支持的文件类型')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('文件大小不能超过2MB')
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
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
