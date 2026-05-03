/**
 * 全站底部法律与性质说明（置于根 layout，随全站展示）
 */
export function SiteFooter() {
  return (
    <footer
      className="border-t border-border/60 bg-muted/30 px-4 py-8 text-center text-muted-foreground"
      role="contentinfo"
    >
      <div className="mx-auto max-w-3xl space-y-3 text-xs leading-relaxed md:text-sm">
        <p>
          本站由 AI 开发完成，本站的内容由 AI
          生成，如有版权或内容的不同，请联系本站。
        </p>
        <p>本站基于 AI 爱好者互相学习的目的构建。</p>
      </div>
    </footer>
  )
}
