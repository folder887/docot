import { type ReactNode } from 'react'

/**
 * Tiny markdown renderer for chat / posts / notes.
 *
 * Inline: **bold**, *italic*, ~~strike~~, `code`, [text](url),
 *         ==text== for highlight, [#color:text] for coloured text.
 * Block (line-prefixed): "# / ## / ### " heading, "> " quote, "!> " callout.
 *
 * Intentionally no full CommonMark — chat is mostly a few lines, the
 * tokenizer is hot, and a tiny subset keeps the rendered surface area small
 * (and predictable for security review).
 */

type Token =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: Token[] }
  | { type: 'italic'; children: Token[] }
  | { type: 'strike'; children: Token[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Token[] }
  | { type: 'highlight'; children: Token[] }
  | { type: 'color'; color: string; children: Token[] }
  | { type: 'mention'; handle: string }

const ALLOWED_COLORS = new Set([
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'gray',
])

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
    // highlight: ==...==
    if (c === '=' && input[i + 1] === '=') {
      const end = input.indexOf('==', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: 'highlight', children: tokenize(input.slice(i + 2, end)) })
        i = end + 2
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
    // colour: [color:text] where color is a whitelisted name
    if (c === '[') {
      const colorMatch = /^\[(red|orange|yellow|green|blue|purple|pink|gray):/i.exec(
        input.slice(i),
      )
      if (colorMatch) {
        const inner = i + colorMatch[0].length
        const close = input.indexOf(']', inner)
        if (close > inner) {
          const color = colorMatch[1].toLowerCase()
          if (ALLOWED_COLORS.has(color)) {
            flush()
            out.push({
              type: 'color',
              color,
              children: tokenize(input.slice(inner, close)),
            })
            i = close + 1
            continue
          }
        }
      }
      // link: [text](url)
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
    // @-mention: @handle (3..32 chars, [a-z0-9_]). Require a non-word char
    // before the @ so we don't mistake "email@domain" for a mention.
    if (c === '@') {
      const prev = i === 0 ? '' : input[i - 1]
      if (!prev || /[^\w]/.test(prev)) {
        const m = /^@([a-z0-9_]{3,32})/i.exec(input.slice(i))
        if (m) {
          flush()
          out.push({ type: 'mention', handle: m[1].toLowerCase() })
          i += m[0].length
          continue
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

const COLOR_CLASSES: Record<string, string> = {
  red: 'text-red-600 dark:text-red-400',
  orange: 'text-orange-600 dark:text-orange-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  green: 'text-green-600 dark:text-green-400',
  blue: 'text-blue-600 dark:text-blue-400',
  purple: 'text-purple-600 dark:text-purple-400',
  pink: 'text-pink-600 dark:text-pink-400',
  gray: 'text-gray-500',
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
      case 'highlight':
        return (
          <mark key={k} className="rounded bg-yellow-200 px-1 text-ink dark:bg-yellow-300/40 dark:text-paper">
            {renderTokens(tok.children, k + '-')}
          </mark>
        )
      case 'color':
        return (
          <span key={k} className={COLOR_CLASSES[tok.color]}>
            {renderTokens(tok.children, k + '-')}
          </span>
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
      case 'mention':
        return (
          <a
            key={k}
            href={`/u/${tok.handle}`}
            className="font-bold underline decoration-current underline-offset-2"
          >
            @{tok.handle}
          </a>
        )
    }
  })
}

/** Extract all @handles referenced in a piece of text. Uses the same
 * tokenizer so mentions inside code spans / links / etc. don't leak. */
export function extractMentions(text: string): string[] {
  const seen = new Set<string>()
  const walk = (toks: Token[]): void => {
    for (const t of toks) {
      if (t.type === 'mention') seen.add(t.handle)
      else if ('children' in t) walk(t.children)
    }
  }
  walk(tokenize(text))
  return [...seen]
}

type Block =
  | { type: 'p'; children: Token[] }
  | { type: 'h'; level: 1 | 2 | 3; children: Token[] }
  | { type: 'quote'; lines: Token[][] }
  | { type: 'callout'; lines: Token[][] }

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const h3 = /^### (.*)$/.exec(line)
    const h2 = /^## (.*)$/.exec(line)
    const h1 = /^# (.*)$/.exec(line)
    const callout = /^!> (.*)$/.exec(line)
    const quote = /^> (.*)$/.exec(line)
    if (h3) {
      blocks.push({ type: 'h', level: 3, children: tokenize(h3[1]) })
      i++
      continue
    }
    if (h2) {
      blocks.push({ type: 'h', level: 2, children: tokenize(h2[1]) })
      i++
      continue
    }
    if (h1) {
      blocks.push({ type: 'h', level: 1, children: tokenize(h1[1]) })
      i++
      continue
    }
    if (callout) {
      const collected: Token[][] = [tokenize(callout[1])]
      i++
      while (i < lines.length) {
        const m = /^!> (.*)$/.exec(lines[i])
        if (!m) break
        collected.push(tokenize(m[1]))
        i++
      }
      blocks.push({ type: 'callout', lines: collected })
      continue
    }
    if (quote) {
      const collected: Token[][] = [tokenize(quote[1])]
      i++
      while (i < lines.length) {
        const m = /^> (.*)$/.exec(lines[i])
        if (!m) break
        collected.push(tokenize(m[1]))
        i++
      }
      blocks.push({ type: 'quote', lines: collected })
      continue
    }
    blocks.push({ type: 'p', children: tokenize(line) })
    i++
  }
  return blocks
}

function renderBlocks(blocks: Block[]): ReactNode[] {
  return blocks.map((b, i) => {
    const k = `b${i}`
    if (b.type === 'h') {
      const Tag = (`h${b.level}` as 'h1' | 'h2' | 'h3')
      const cls =
        b.level === 1
          ? 'text-2xl font-black mt-2 mb-1'
          : b.level === 2
            ? 'text-xl font-black mt-2 mb-1'
            : 'text-lg font-black mt-1 mb-0.5'
      return (
        <Tag key={k} className={cls}>
          {renderTokens(b.children, k + '-')}
        </Tag>
      )
    }
    if (b.type === 'quote') {
      return (
        <blockquote
          key={k}
          className="my-1 border-l-4 border-current/50 pl-3 italic opacity-90"
        >
          {b.lines.map((ln, j) => (
            <span key={j}>
              {renderTokens(ln, `${k}-${j}-`)}
              {j < b.lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </blockquote>
      )
    }
    if (b.type === 'callout') {
      return (
        <div
          key={k}
          className="my-1 rounded-xl border-2 border-current/40 bg-current/5 px-3 py-2 text-[0.95em]"
        >
          {b.lines.map((ln, j) => (
            <span key={j}>
              {renderTokens(ln, `${k}-${j}-`)}
              {j < b.lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </div>
      )
    }
    return (
      <span key={k}>
        {renderTokens(b.children, k + '-')}
        {i < blocks.length - 1 ? '\n' : null}
      </span>
    )
  })
}

export function LiteMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  return <>{renderBlocks(blocks)}</>
}
