/**
 * useColorSemantics — 颜色语义描述 + 无障碍标签 composable
 *
 * 职责：
 * - 多语言词典（zh / en）
 * - OKLCH 颜色分析（achromatic / chromatic + 饱和度 / 亮度 / 透明度）
 * - 语义描述生成（"鲜艳的浅蓝色" / "vivid light blue"）
 * - 触发器 aria-label、网格 aria-label、单元格 aria-label
 */
import { computed } from 'vue'
import { parseOklch } from '../utils/oklch.js'

// ═══════════════════════════════════════════
//  感知非均匀 hue 分区
//
//  黄色视觉范围窄 → 区间窄
//  蓝色 / 绿色视觉范围宽 → 区间宽
//  低 chroma 时感知漂移 → 单独处理 achromatic
// ═══════════════════════════════════════════
const HUE_SEGMENTS = [
  { max: 20,  key: 'red' },
  { max: 50,  key: 'orange' },
  { max: 85,  key: 'yellow' },
  { max: 165, key: 'green' },
  { max: 210, key: 'cyan' },
  { max: 275, key: 'blue' },
  { max: 320, key: 'purple' },
  { max: 360, key: 'pink' },
]

// ── 色相名 ──
const HUE_LABELS = {
  zh: { red:'红色', orange:'橙色', yellow:'黄色', green:'绿色', cyan:'青色', blue:'蓝色', purple:'紫色', pink:'粉色' },
  en: { red:'red', orange:'orange', yellow:'yellow', green:'green', cyan:'cyan', blue:'blue', purple:'purple', pink:'pink' },
}

// ── 饱和度描述词 ──
const SAT_LABELS = {
  zh: { muted:'柔和', vivid:'鲜艳' },
  en: { muted:'muted', vivid:'vivid' },
}

// ── 亮度描述词 ──
const BRI_LABELS = {
  zh: { dark:'深', light:'浅', bright:'亮' },
  en: { dark:'dark', light:'light', bright:'bright' },
}

// ── 透明度描述词 ──
const ALPHA_LABELS = {
  zh: { transparent:'高度透明', semiTransparent:'半透明', slightTransparent:'略透明' },
  en: { transparent:'highly transparent', semiTransparent:'semi-transparent', slightTransparent:'slightly transparent' },
}

// ── 无彩色名 ──
const ACHROMATIC_LABELS = {
  zh(l) {
    if (l < 0.15) return '黑色'
    if (l < 0.35) return '深灰色'
    if (l < 0.55) return '灰色'
    if (l < 0.75) return '浅灰色'
    return '白色'
  },
  en(l) {
    if (l < 0.15) return 'black'
    if (l < 0.35) return 'dark gray'
    if (l < 0.55) return 'gray'
    if (l < 0.75) return 'light gray'
    return 'white'
  },
}

// ── UI 文本标签 ──
const UI_LABELS = {
  zh: {
    colorPicker: (cols, rows) => `颜色选择器 — ${cols} 列 × ${rows} 行`,
    currentColor: (desc, extra, raw) => `当前颜色: ${desc}${extra} — ${raw}`,
    alphaPercent: (pct) => `，透明度 ${pct}%`,
    transparent: '空白',
    lowAlpha: (name) => `${name}，透明度低`,
  },
  en: {
    colorPicker: (cols, rows) => `Color picker — ${cols} columns × ${rows} rows`,
    currentColor: (desc, extra, raw) => `Current color: ${desc}${extra} — ${raw}`,
    alphaPercent: (pct) => `, ${pct}% opacity`,
    transparent: 'empty',
    lowAlpha: (name) => `${name}, low opacity`,
  },
}

// ── 格式化器（不同语言定义不同词序）──
const FORMATTERS = {
  zh: {
    achromatic(l) { return ACHROMATIC_LABELS.zh(l) },
    chromatic({ sat, bri, alpha, hueName }) {
      const prefix = alpha || (sat + bri)
      return prefix + hueName
    },
  },
  en: {
    achromatic(l) { return ACHROMATIC_LABELS.en(l) },
    chromatic({ sat, bri, alpha, hueName }) {
      const prefix = alpha || [bri, sat].filter(Boolean).join(' ')
      return prefix ? `${prefix} ${hueName}` : hueName
    },
  },
}

// ═══════════════════════════════════════════
//  内部纯函数
// ═══════════════════════════════════════════

const ACHROMATIC_THRESHOLD = 0.02

function getHueKey(hue) {
  for (const seg of HUE_SEGMENTS) {
    if (hue <= seg.max) return seg.key
  }
  return 'red'
}

function analyzeColor(colorStr) {
  const parsed = parseOklch(colorStr)
  if (!parsed) return null

  const { l, c, h, alpha: alphaVal } = parsed

  if (c === null || c < ACHROMATIC_THRESHOLD) {
    return { achromatic: true, l: l ?? 0.5, alpha: alphaVal }
  }

  const hueKey = getHueKey(h ?? 0)
  const hueName = hueKey

  // 饱和度
  let sat = ''
  if (c < 0.04) sat = 'muted'
  else if (c > 0.15) sat = 'vivid'

  // 亮度
  let bri = ''
  if (l < 0.35) bri = 'dark'
  else if (l > 0.8) bri = 'light'
  else if (l > 0.65) bri = 'bright'

  // 透明度
  let alpha = ''
  if (alphaVal !== null && alphaVal < 0.5) {
    if (alphaVal < 0.2) alpha = 'transparent'
    else alpha = 'semiTransparent'
  } else if (alphaVal !== null && alphaVal < 0.8) {
    alpha = 'slightTransparent'
  }

  return {
    achromatic: false,
    hueKey,
    hueName,
    sat,
    bri,
    alpha,
    l,
    c,
    alphaVal,
  }
}

function describeColor(colorStr, locale = 'zh', verbosity = 'full') {
  const fmt = FORMATTERS[locale] || FORMATTERS.zh
  const analysis = analyzeColor(colorStr)
  if (!analysis) return colorStr

  if (verbosity === 'brief') {
    if (analysis.achromatic) return fmt.achromatic(analysis.l)
    const labels = HUE_LABELS[locale] || HUE_LABELS.zh
    return labels[analysis.hueKey] || analysis.hueKey
  }

  // full 模式
  if (analysis.achromatic) {
    let base = fmt.achromatic(analysis.l)
    if (analysis.alpha !== null && analysis.alpha < 0.8) {
      const al = ALPHA_LABELS[locale] || ALPHA_LABELS.zh
      const alphaDesc = analysis.alpha < 0.2 ? al.transparent
        : analysis.alpha < 0.5 ? al.semiTransparent
        : al.slightTransparent
      base = locale === 'zh' ? alphaDesc + base : `${alphaDesc} ${base}`
    }
    return base
  }

  // chromatic full
  const labels = HUE_LABELS[locale] || HUE_LABELS.zh
  const satLabels = SAT_LABELS[locale] || SAT_LABELS.zh
  const briLabels = BRI_LABELS[locale] || BRI_LABELS.zh
  const alLabels = ALPHA_LABELS[locale] || ALPHA_LABELS.zh

  const satDisplay = analysis.sat ? satLabels[analysis.sat] : ''
  const briDisplay = analysis.bri ? briLabels[analysis.bri] : ''
  const alphaDisplay = analysis.alpha ? alLabels[analysis.alpha] : ''
  const hueDisplay = labels[analysis.hueKey] || analysis.hueKey

  return fmt.chromatic({
    sat: satDisplay,
    bri: briDisplay,
    alpha: alphaDisplay,
    hueName: hueDisplay,
  })
}

// ═══════════════════════════════════════════
//  Composable
// ═══════════════════════════════════════════

/**
 * @param {object} options
 * @param {import('vue').Ref<string>} options.locale
 * @param {import('vue').Ref<string>} options.colorValue
 * @param {number} options.gridCols
 * @param {number} options.gridRows
 */
export function useColorSemantics({ locale, colorValue, gridCols, gridRows }) {
  // 当前 locale 的快照，供非响应式上下文（如 v-for 中的函数调用）使用
  const t = (dict) => {
    const loc = locale?.value || 'zh'
    return dict[loc] || dict.zh
  }

  const triggerLabel = computed(() => {
    const loc = locale?.value || 'zh'
    const ui = t(UI_LABELS)
    const desc = describeColor(colorValue.value, loc, 'full')
    const analysis = analyzeColor(colorValue.value)
    let extra = ''
    if (analysis && analysis.alphaVal !== null && analysis.alphaVal < 0.95) {
      const pct = Math.round(analysis.alphaVal * 100)
      extra = ui.alphaPercent(pct)
    }
    return ui.currentColor(desc, extra, colorValue.value)
  })

  const gridAriaLabel = computed(() => {
    const ui = t(UI_LABELS)
    return ui.colorPicker(gridCols, gridRows)
  })

  /**
   * 动态计算 gridcell 的 aria-label（跟随 locale）
   */
  function getCellAriaLabel(dot) {
    const ui = t(UI_LABELS)
    if (dot.isTransparent) return ui.transparent
    const labels = t(HUE_LABELS)
    const name = labels[dot.hueKey] || dot.hueKey
    if (dot.alpha < 0.3) return ui.lowAlpha(name)
    return name
  }

  return {
    triggerLabel,
    gridAriaLabel,
    getCellAriaLabel,
    // 额外导出纯函数，供组件在别处使用
    analyzeColor,
    describeColor,
  }
}
