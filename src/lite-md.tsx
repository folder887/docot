import { type ReactNode } from 'react'

/**
 * Tiny inline markdown renderer for chat / posts.
 * Supports: **bold**, *italic*, ~~strike~~, `code`, [text](url)
 * No block-level constructs — intentional, chat is mostly inline.
 */

type Token =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: Token[] }
  | { type: 'italic'; children: Token[] }
  | { type: 'strike'; children: Token[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Token[] }

function tokenize(input: string): Token[] {
  const out: Token[] = []
  let i = 0
  let buf = ''
  const flush = () => {
    if (buf) {
      out.push({ type: 'text', value: buf })
      buf = ''
    }
  }
  while (i < input.length) {
    const c = input[i]
    // code: `...`
    if (c === '`') {
      const end = input.indexOf('`', i + 1)
      if (end > i) {
        flush()
        out.push({ type: 'code', value: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    // bold: **...**
    if (c === '*' && input[i + 1] === '*') {
      const end = input.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: 'bold', children: tokenize(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    // italic: *...* (single)
    if (c === '*' && input[i + 1] !== '*') {
      const end = input.indexOf('*', i + 1)
      if (end > i + 1 && input[end - 1] !== ' ') {
        flush()
        out.push({ type: 'italic', children: tokenize(input.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    // strike: ~~...~~
    if (c === '~' && input[i + 1] === '~') {
      const end = input.indexOf('~~', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: 'strike', children: tokenize(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    // link: [text](url)
    if (c === '[') {
      const closeBracket = input.indexOf(']', i + 1)
      if (closeBracket > i && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2)
        if (closeParen > closeBracket) {
          const text = input.slice(i + 1, closeBracket)
          const href = input.slice(closeBracket + 2, closeParen)
          if (/^https?:\/\//i.test(href)) {
            flush()
            out.push({ type: 'link', href, children: tokenize(text) })
            i = closeParen + 1
            continue
          }
        }
      }
    }
    // bare URL autolink
    if ((c === 'h' || c === 'H') && /^https?:\/\//i.test(input.slice(i))) {
      const m = /^https?:\/\/[^\s<>"']+/.exec(input.slice(i))
      if (m) {
        flush()
        out.push({ type: 'link', href: m[0], children: [{ type: 'text', value: m[0] }] })
        i += m[0].length
        continue
      }
    }
    buf += c
    i++
  }
  flush()
  return out
}

function renderTokens(tokens: Token[], keyPrefix = ''): ReactNode[] {
  return tokens.map((tok, idx) => {
    const k = `${keyPrefix}${idx}`
    switch (tok.type) {
      case 'text':
        return <span key={k}>{tok.value}</span>
      case 'bold':
        return <strong key={k} className="font-black">{renderTokens(tok.children, k + '-')}</strong>
      case 'italic':
        return <em key={k}>{renderTokens(tok.children, k + '-')}</em>
      case 'strike':
        return <s key={k}>{renderTokens(tok.children, k + '-')}</s>
      case 'code':
        return (
          <code key={k} className="rounded border border-current/30 bg-current/10 px-1 font-mono text-[0.92em]">
            {tok.value}
          </code>
        )
      case 'link':
        return (
          <a
            key={k}
            href={tok.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-current underline-offset-2"
          >
            {renderTokens(tok.children, k + '-')}
          </a>
        )
    }
  })
}

export function LiteMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {renderTokens(tokenize(line))}
          {i < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </>
  )
}
