'use client'

import type { ComponentProps } from 'react'
import DOMPurify from 'dompurify'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import {
  normalizeIntroductionFormat,
  type IntroductionFormat,
} from '@/lib/introduction-format'

/** 未装 @tailwindcss/typography 时 prose 无效，用显式样式保证 Markdown 层级 */
const mdComponents = {
  h1: (props: ComponentProps<'h1'>) => (
    <h1
      className="mt-4 mb-2 text-2xl font-bold text-foreground first:mt-0"
      {...props}
    />
  ),
  h2: (props: ComponentProps<'h2'>) => (
    <h2 className="mt-4 mb-2 text-xl font-semibold text-foreground" {...props} />
  ),
  h3: (props: ComponentProps<'h3'>) => (
    <h3 className="mt-3 mb-1.5 text-lg font-semibold text-foreground" {...props} />
  ),
  h4: (props: ComponentProps<'h4'>) => (
    <h4 className="mt-3 mb-1 text-base font-semibold text-foreground" {...props} />
  ),
  p: (props: ComponentProps<'p'>) => (
    <p className="mb-3 leading-relaxed text-muted-foreground last:mb-0" {...props} />
  ),
  ul: (props: ComponentProps<'ul'>) => (
    <ul
      className="mb-3 list-outside list-disc space-y-2 pl-6 text-muted-foreground marker:text-muted-foreground"
      {...props}
    />
  ),
  ol: (props: ComponentProps<'ol'>) => (
    <ol
      className="mb-3 list-outside list-decimal space-y-2 pl-6 text-muted-foreground marker:text-muted-foreground"
      {...props}
    />
  ),
  li: (props: ComponentProps<'li'>) => (
    <li className="leading-relaxed [&>p]:mb-1 [&>p:last-child]:mb-0" {...props} />
  ),
  img: ({ src, alt, ...props }: ComponentProps<'img'>) => {
    if (!src || typeof src !== 'string') return null
    return (
      <span className="my-4 block">
        {/* 用原生 img：Markdown 内外链任意，避免 Next/Image 域名限制与 404 处理复杂化 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ''}
          className="max-h-[min(80vh,720px)] max-w-full rounded-lg border border-border object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          {...props}
        />
      </span>
    )
  },
  a: (props: ComponentProps<'a'>) => (
    <a className="font-medium text-primary underline-offset-4 hover:underline" {...props} />
  ),
  strong: (props: ComponentProps<'strong'>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  em: (props: ComponentProps<'em'>) => (
    <em className="italic text-foreground/90" {...props} />
  ),
  blockquote: (props: ComponentProps<'blockquote'>) => (
    <blockquote
      className="mb-3 border-l-2 border-primary/40 pl-4 text-muted-foreground italic"
      {...props}
    />
  ),
  code: ({
    inline,
    className,
    children,
    ...props
  }: ComponentProps<'code'> & { inline?: boolean }) =>
    inline ? (
      <code
        className="rounded bg-muted px-1 py-0.5 text-sm text-foreground"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        className={cn(
          'block w-full overflow-x-auto rounded-lg bg-muted p-3 text-sm text-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </code>
    ),
  pre: (props: ComponentProps<'pre'>) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-muted" {...props} />
  ),
  hr: (props: ComponentProps<'hr'>) => (
    <hr className="my-6 border-border" {...props} />
  ),
}

export function ToolIntroductionDisplay({
  content,
  format: formatProp,
  className,
}: {
  content: string
  format: IntroductionFormat | string | null | undefined
  className?: string
}) {
  if (!content.trim()) return null

  const format = normalizeIntroductionFormat(formatProp as string | undefined)

  if (format === 'plain') {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    )
  }

  if (format === 'markdown') {
    return (
      <div
        className={cn(
          'text-sm sm:px-2 md:px-6 lg:px-8',
          className,
        )}
      >
        <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'tool-intro-html text-sm leading-relaxed text-muted-foreground sm:px-2 md:px-6 lg:px-8 [&_a]:break-all [&_a]:text-primary',
        className,
      )}
      // eslint-disable-next-line react/no-danger -- HTML 模式经 DOMPurify 消毒
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(content),
      }}
    />
  )
}
