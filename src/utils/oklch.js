/**
 * OKLCH 颜色字符串解析器
 *
 * 支持格式：
 *   oklch(0.65 0.22 180)
 *   oklch(0.65 0.22 180 / 0.55)
 *   oklch(65% 0.22 180)
 *   oklch(65% 0.15 180deg)
 *   oklch(0.65 0.22 180 / 55%)
 *   oklch(0.65 none 180)       → c = null
 *
 * @param {string} str - OKLCH 颜色字符串
 * @returns {{ l: number, c: number|null, h: number, alpha: number|null } | null}
 */

// 找到未嵌套在括号内的 '/'
function findSlash(str) {
  let depth = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') depth--
    else if (str[i] === '/' && depth === 0) return i
  }
  return -1
}

// 解析 CSS 数值：支持 0.65、65%、180deg、none
function parseCssNumber(raw) {
  if (!raw) return null
  const s = raw.trim()
  if (s === 'none') return null
  const degStripped = s.replace(/deg$/i, '')
  if (degStripped.endsWith('%')) {
    const v = parseFloat(degStripped)
    return isNaN(v) ? null : v / 100
  }
  const v = parseFloat(degStripped)
  return isNaN(v) ? null : v
}

// none 专用（chroma 可以是 none → null 表示缺失）
function parseCssNumberOrNone(raw) {
  const s = raw?.trim()
  if (!s || s === 'none') return null
  return parseCssNumber(s)
}

export function parseOklch(str) {
  if (typeof str !== 'string') return null

  const s = str.trim()

  const fnMatch = s.match(/^oklch\(\s*(.+)\s*\)$/i)
  if (!fnMatch) return null

  const inner = fnMatch[1]
  const slashIdx = findSlash(inner)
  const colorPart = slashIdx >= 0 ? inner.slice(0, slashIdx) : inner
  const alphaRaw = slashIdx >= 0 ? inner.slice(slashIdx + 1).trim() : null

  const parts = colorPart.split(/\s+/).filter(Boolean)
  if (parts.length < 3) return null

  const l = parseCssNumber(parts[0])
  const c = parseCssNumberOrNone(parts[1])
  const h = parseCssNumber(parts[2])

  if (l === null && h === null) return null

  const alpha = alphaRaw ? parseCssNumber(alphaRaw) : null

  return { l: l ?? 0, c, h: h ?? 0, alpha }
}
