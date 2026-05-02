import { NextResponse } from 'next/server'

/** 图片已改为在浏览器内转为 Base64 写入数据库，不再使用此上传接口。 */
export function POST() {
  return NextResponse.json(
    {
      error:
        '上传接口已停用：请在提交页选择图片，系统将自动转为 Base64 保存。',
    },
    { status: 410 },
  )
}
