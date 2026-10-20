/**
 * Host-side HTML helpers for the page-context plugin.
 *
 * Two jobs:
 *  - sanitize a fetched document so the same-origin preview iframe can render it
 *    without executing page scripts;
 *  - parse a (sanitized) document into a small DOM-like tree so the page_context
 *    tool can report text, interactive elements and one selected element.
 *
 * The selector grammar is deliberately tiny and identical to the Client picker:
 *   tag#id | tag.class1.class2 | tag[data-testid="value"] | tag:nth-of-type(n)
 * joined with " > ".
 */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
])

/** Elements whose text content is raw markup data rather than rendered text. */
const RAW_TAGS = new Set(['style', 'title', 'textarea'])

/** Subtrees that contribute no readable text to a snapshot. */
const TEXT_SKIP = new Set([
  'script', 'style', 'template', 'svg', 'canvas', 'iframe', 'object',
  'embed', 'noscript', 'head',
])

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
])

const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'label', 'summary',
])

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch', 'option',
])

const NAME_RE = /[^\s/>]/

/**
 * Remove everything that could execute, submit, or navigate the preview frame,
 * and neutralize script URLs. Presentation (styles, images, text) is preserved.
 *
 * @param {string} html raw upstream markup.
 * @returns {string} markup safe to serve at the application origin.
 */
export function sanitizeHtml(html) {
  let out = String(html ?? '')
  out = out.replace(/<!--[\s\S]*?-->/g, '')
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  out = out.replace(/<script\b[^>]*\/?>/gi, '')
  out = out.replace(/<(iframe|frame|frameset|object|embed|applet|noembed|noframes)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  out = out.replace(/<(iframe|frame|frameset|object|embed|applet|noembed|noframes)\b[^>]*\/?>/gi, '')
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*("|')?refresh\1?[^>]*>/gi, '')
  out = out.replace(/<base\b[^>]*>/gi, '')
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  out = out.replace(/(\s(?:href|src|action|xlink:href)\s*=\s*)"\s*(?:javascript|vbscript|data:text\/html)[^"]*"/gi, '$1"#"')
  out = out.replace(/(\s(?:href|src|action|xlink:href)\s*=\s*)'\s*(?:javascript|vbscript|data:text\/html)[^']*'/gi, "$1'#'")
  out = out.replace(/(\s(?:href|src|action|xlink:href)\s*=\s*)(?:javascript|vbscript|data:text\/html)[^\s>]*/gi, '$1#')
  return out
}

/**
 * Parse sanitized markup into a DOM-like tree.
 *
 * @param {string} html sanitized markup.
 * @returns {object} root node with `tag: '#root'`, `attrs` and `children`.
 */
export function parseHtml(html) {
  const source = String(html ?? '')
  const root = { tag: '#root', attrs: {}, children: [], parent: null }
  const stack = [root]
  const length = source.length
  let index = 0

  const pushText = (text, parent) => {
    if (!text) return
    const decoded = decodeEntities(text)
    if (!decoded) return
    parent.children.push({ type: 'text', text: decoded, parent })
  }

  while (index < length) {
    const lt = source.indexOf('<', index)
    if (lt < 0) {
      pushText(source.slice(index), stack[stack.length - 1])
      break
    }
    if (lt > index) pushText(source.slice(index, lt), stack[stack.length - 1])

    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4)
      index = end < 0 ? length : end + 3
      continue
    }
    if (source.startsWith('<!', lt) || source.startsWith('<?', lt)) {
      const end = source.indexOf('>', lt)
      index = end < 0 ? length : end + 1
      continue
    }

    const closing = source[lt + 1] === '/'
    let cursor = lt + (closing ? 2 : 1)
    let nameEnd = cursor
    while (nameEnd < length && NAME_RE.test(source[nameEnd])) nameEnd += 1
    const name = source.slice(cursor, nameEnd).toLowerCase()
    if (!name) {
      pushText('<', stack[stack.length - 1])
      index = lt + 1
      continue
    }

    let tagEnd = nameEnd
    let quote = ''
    while (tagEnd < length) {
      const ch = source[tagEnd]
      if (quote) {
        if (ch === quote) quote = ''
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else if (ch === '>') {
        break
      }
      tagEnd += 1
    }
    const inner = source.slice(nameEnd, tagEnd)
    const selfClosing = inner.trimEnd().endsWith('/')
    index = tagEnd + 1

    if (closing) {
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].tag === name) {
          stack.length = depth
          break
        }
      }
      continue
    }

    const parent = stack[stack.length - 1]
    const node = { tag: name, attrs: parseAttrs(inner), children: [], parent }
    parent.children.push(node)

    if (VOID_TAGS.has(name) || selfClosing) continue
    if (RAW_TAGS.has(name)) {
      const lower = source.toLowerCase()
      const closeAt = lower.indexOf(`</${name}`, index)
      if (closeAt < 0) {
        pushText(source.slice(index), node)
        index = length
      } else {
        pushText(source.slice(index, closeAt), node)
        const gt = source.indexOf('>', closeAt)
        index = gt < 0 ? length : gt + 1
      }
      continue
    }
    stack.push(node)
  }

  return root
}

/**
 * Attribute name/value pairs from the text between a tag name and `>`.
 *
 * @param {string} inner raw attribute text.
 * @returns {Record<string, string>}
 */
export function parseAttrs(inner) {
  const attrs = {}
  if (!inner) return attrs
  const re = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]*))?/g
  let match
  while ((match = re.exec(inner)) !== null) {
    const name = match[1].toLowerCase()
    if (!name || name === '/') continue
    let value = match[2]
    if (value === undefined) value = ''
    else if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1, -1)
    attrs[name] = decodeEntities(value)
  }
  return attrs
}

/**
 * Decode the entities that matter for readable text.
 *
 * @param {string} text
 * @returns {string}
 */
export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function safeCodePoint(code) {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

/**
 * Readable text of a subtree, with block-level line breaks.
 *
 * @param {object} node parsed node.
 * @param {{ maxChars?: number }} [options]
 * @returns {string}
 */
export function textOf(node, options = {}) {
  const maxChars = options.maxChars ?? 20000
  const parts = []
  let size = 0
  const push = (text) => {
    if (!text || size >= maxChars) return
    parts.push(text)
    size += text.length
  }
  const walk = (current) => {
    if (!current || size >= maxChars) return
    if (current.type === 'text') {
      push(current.text)
      return
    }
    if (TEXT_SKIP.has(current.tag)) return
    const block = BLOCK_TAGS.has(current.tag)
    if (block) push('\n')
    for (const child of current.children) walk(child)
    if (block) push('\n')
  }
  walk(node)
  return normalizeText(parts.join('')).slice(0, maxChars)
}

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Document title from the parsed tree.
 *
 * @param {object} root
 * @returns {string}
 */
export function titleOf(root) {
  let title = ''
  const walk = (node) => {
    if (title || !node || node.type === 'text') return
    if (node.tag === 'title') {
      title = textOf(node, { maxChars: 200 }).replace(/\s+/g, ' ').trim()
      return
    }
    for (const child of node.children || []) walk(child)
  }
  walk(root)
  return title
}

/**
 * CSS-like selector for a parsed node, matching the Client picker's grammar.
 *
 * @param {object} node
 * @returns {string}
 */
export function cssPath(node) {
  const parts = []
  let current = node
  let depth = 0
  while (current && current.tag && current.tag !== '#root' && depth < 6) {
    const id = current.attrs.id
    if (id && /^[A-Za-z_][\w-]*$/.test(id)) {
      parts.unshift(`#${id}`)
      break
    }
    let part = current.tag
    const testId = current.attrs['data-testid'] || current.attrs['data-test']
    if (testId) {
      parts.unshift(`${part}[data-testid="${String(testId).replace(/"/g, '')}"]`)
      break
    }
    const classes = String(current.attrs.class || '')
      .split(/\s+/)
      .filter((name) => /^[A-Za-z_-][\w-]*$/.test(name))
      .slice(0, 2)
    if (classes.length > 0) part += `.${classes.join('.')}`
    const parent = current.parent
    if (parent && parent.children) {
      const sameTag = parent.children.filter((child) => child.type !== 'text' && child.tag === current.tag)
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`
    }
    parts.unshift(part)
    current = parent
    depth += 1
  }
  return parts.join(' > ')
}

/**
 * Interactive elements, headings and labelled controls with their selectors.
 *
 * @param {object} root
 * @param {number} [limit]
 * @returns {Array<{ selector: string, tag: string, text: string, type?: string }>}
 */
export function collectElements(root, limit = 200) {
  const out = []
  const walk = (node) => {
    if (out.length >= limit) return
    if (node.type !== 'text' && node.tag !== '#root') {
      const role = String(node.attrs.role || '').toLowerCase()
      const interesting = INTERACTIVE_TAGS.has(node.tag)
        || HEADING_TAGS.has(node.tag)
        || INTERACTIVE_ROLES.has(role)
      if (interesting) {
        const label = textOf(node, { maxChars: 160 }).replace(/\s+/g, ' ').trim()
        const entry = {
          selector: cssPath(node),
          tag: node.tag,
          text: label.slice(0, 120),
        }
        if (node.attrs.type) entry.type = node.attrs.type
        out.push(entry)
      }
    }
    for (const child of node.children || []) walk(child)
  }
  walk(root)
  return out
}

/**
 * Serialize one node back to markup, capped for context size.
 *
 * @param {object} node
 * @param {number} [maxChars]
 * @returns {string}
 */
export function outerHtml(node, maxChars = 800) {
  const build = (current, budget) => {
    if (current.type === 'text') return escapeHtml(current.text)
    const attrs = Object.entries(current.attrs)
      .slice(0, 8)
      .map(([name, value]) => (value ? ` ${name}="${escapeHtml(value)}"` : ` ${name}`))
      .join('')
    const open = `<${current.tag}${attrs}>`
    if (budget <= 0) return open
    const inner = current.children.map((child) => build(child, budget - open.length)).join('')
    return `${open}${inner}</${current.tag}>`
  }
  const html = build(node, maxChars)
  return html.length > maxChars ? `${html.slice(0, maxChars)}…` : html
}

/**
 * Resolve the first node matching a selector produced by {@link cssPath}.
 *
 * @param {object} root
 * @param {string} selector
 * @returns {object|null}
 */
export function matchSelector(root, selector) {
  const text = String(selector || '').trim()
  if (!text) return null
  const segments = text.split('>').map((part) => part.trim()).filter(Boolean).slice(0, 8)
  if (segments.length === 0) return null
  const parsed = segments.map(parseSegment)
  if (parsed.some((segment) => segment === null)) return null

  let current = [root]
  for (let index = 0; index < parsed.length; index += 1) {
    const segment = parsed[index]
    const next = []
    for (const parent of current) {
      if (index === 0) {
        collectMatches(parent, segment, next)
      } else {
        for (const child of parent.children || []) {
          if (child.type !== 'text' && matchesSegment(child, segment)) next.push(child)
        }
      }
    }
    if (next.length === 0) return null
    current = next
  }
  return current[0] || null
}

function collectMatches(node, segment, out) {
  for (const child of node.children || []) {
    if (child.type === 'text') continue
    if (matchesSegment(child, segment)) out.push(child)
    collectMatches(child, segment, out)
  }
}

function parseSegment(text) {
  const segment = { tag: null, id: null, classes: [], testId: null, nth: null }
  let rest = text
  const nth = /:nth-of-type\((\d+)\)$/.exec(rest)
  if (nth) {
    segment.nth = Number(nth[1])
    rest = rest.slice(0, nth.index)
  }
  const testId = /\[data-testid="([^"]*)"\]$/.exec(rest)
  if (testId) {
    segment.testId = testId[1]
    rest = rest.slice(0, testId.index)
  }
  const id = /#([A-Za-z_][\w-]*)/.exec(rest)
  if (id) {
    segment.id = id[1]
    rest = `${rest.slice(0, id.index)}${rest.slice(id.index + id[0].length)}`
  }
  const classes = rest.match(/\.[A-Za-z_-][\w-]*/g) || []
  segment.classes = classes.map((name) => name.slice(1))
  rest = rest.replace(/\.[A-Za-z_-][\w-]*/g, '')
  if (rest && rest !== '*') segment.tag = rest.toLowerCase()
  if (!segment.tag && !segment.id && segment.classes.length === 0 && !segment.testId && !segment.nth) return null
  return segment
}

function matchesSegment(node, segment) {
  if (!node || node.type === 'text' || node.tag === '#root') return false
  if (segment.tag && node.tag !== segment.tag) return false
  if (segment.id && node.attrs.id !== segment.id) return false
  if (segment.testId && (node.attrs['data-testid'] ?? node.attrs['data-test']) !== segment.testId) return false
  if (segment.classes.length > 0) {
    const list = String(node.attrs.class || '').split(/\s+/)
    if (!segment.classes.every((name) => list.includes(name))) return false
  }
  if (segment.nth) {
    const parent = node.parent
    if (!parent) return false
    const sameTag = (parent.children || []).filter((child) => child.type !== 'text' && child.tag === node.tag)
    if (sameTag.indexOf(node) !== segment.nth - 1) return false
  }
  return true
}

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
