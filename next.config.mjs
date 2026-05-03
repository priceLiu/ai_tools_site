/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  /**
   * 编辑工具 / 重新提交：logo、截图为 data URL 时，Server Action 默认可超 1MB。
   * Next 16 须放在 experimental.serverActions（顶层 serverActions 无效）。
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    unoptimized: true,
    // 工具 logo 可为任意 https 外链（批量导入 favicon / 各站图标）
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
