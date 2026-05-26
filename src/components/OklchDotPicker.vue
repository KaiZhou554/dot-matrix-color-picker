<template>
  <div class="oklch-picker relative inline-block">
    <!-- 触发器 -->
    <button
      ref="triggerRef"
      class="w-10 h-10 rounded-lg border-3 border-gray-200 dark:border-gray-600 cursor-pointer
             transition-colors duration-150 outline-none
             focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      :style="{ backgroundColor: modelValue }"
      :aria-label="triggerLabel"
      @click="toggle"
    />

    <!-- 弹出面板 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="open"
          class="fixed inset-0 z-40 bg-black/5"
          @click="close"
        />
      </Transition>

      <Transition name="popup">
        <div
          v-if="open"
          ref="popupRef"
          class="shadow-lg fixed z-50 w-fit rounded-2xl
                 border-3 border-gray-200 dark:border-gray-600 font-sans
                 transition-colors duration-150
                 bg-white dark:bg-gray-800"
          :style="popupStyle"
        >
          <div
            ref="gridRef"
            class="color-grid grid gap-2.5 touch-none"
            role="grid"
            :aria-label="gridAriaLabel"
            :style="{ gridTemplateColumns: `repeat(${GRID.col}, 1fr)` }"
            @mousemove="onPointer($event.clientX, $event.clientY)"
            @mouseup="selectColor"
            @mouseleave="handleLeave"
            @mousedown.stop
            @touchstart.prevent="onPointer($event.touches[0].clientX, $event.touches[0].clientY)"
            @touchmove.prevent="onPointer($event.touches[0].clientX, $event.touches[0].clientY)"
            @touchend="onTouchEnd"
            @touchcancel="handleLeave"
            @blur="onGridBlur"
          >
            <div
              v-for="(dot, index) in dotsData"
              :key="index"
              class="color-dot w-1 h-1 rounded-full outline-none"
              role="gridcell"
              :tabindex="focusedIndex === index ? 0 : -1"
              :aria-colindex="(index % GRID.col) + 1"
              :aria-rowindex="Math.floor(index / GRID.col) + 1"
              :aria-label="getCellAriaLabel(dot)"
              :aria-selected="selectedDotIndex === index || undefined"
              :style="{ backgroundColor: dot.color }"
              @keydown.prevent="onGridKeydown($event, index)"
              @focus="onDotFocus(index)"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '#3b82f6' },
  locale: { type: String, default: 'zh' },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const gridRef = ref(null)
const popupRef = ref(null)
const triggerRef = ref(null)

// ═══════════════════════════════════════════
//  网格配置
// ═══════════════════════════════════════════
const GRID = {
  innerCol: 16,
  innerRow: 10,
  pad: 1,
  get col() { return this.innerCol + this.pad * 2 },
  get row() { return this.innerRow + this.pad * 2 },
  dotSize: 4,
  dotGap: 10,
  get step() { return this.dotSize + this.dotGap },
  baseScale: 1,
  maxScale: 3.5,
  radius: 60,
}

// ═══════════════════════════════════════════
//  OKLCH 感知非均匀 hue 分区
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

// ═══════════════════════════════════════════
//  多语言词典 + 格式化器
//
//  每项是一个 descriptor 对象而非纯字符串，
//  方便不同语言的 formatter 决定词序和拼接。
// ═══════════════════════════════════════════

// ── 色相名（chromatic 时使用）──
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
  zh: (l) => {
    if (l < 0.15) return '黑色'
    if (l < 0.35) return '深灰色'
    if (l < 0.55) return '灰色'
    if (l < 0.75) return '浅灰色'
    return '白色'
  },
  en: (l) => {
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

// ═══════════════════════════════════════════
//  格式化器 — 不同语言定义不同词序
// ═══════════════════════════════════════════
const FORMATTERS = {
  // 中文：修饰词(鲜艳/柔和) + 亮度(深/浅/亮) + 色相名
  //       or 透明度前缀 + 色相名
  //       or 无彩色名
  zh: {
    achromatic(l) { return ACHROMATIC_LABELS.zh(l) },
    chromatic({ sat, bri, alpha, hueName }) {
      // alpha < 0.5 时，透明度比亮度更影响感知，用透明度替换亮度
      let prefix = alpha || (sat + bri)
      return prefix + hueName
    },
  },
  // 英文：brightness + saturation + hue
  //       or alpha + hue
  en: {
    achromatic(l) { return ACHROMATIC_LABELS.en(l) },
    chromatic({ sat, bri, alpha, hueName }) {
      const prefix = alpha || [bri, sat].filter(Boolean).join(' ')
      return prefix ? `${prefix} ${hueName}` : hueName
    },
  },
}

// ═══════════════════════════════════════════
//  OKLCH 解析器（增强版）
//
//  支持格式：
//    oklch(0.65 0.22 180)
//    oklch(0.65 0.22 180 / 0.55)
//    oklch(65% 0.22 180)
//    oklch(65% 0.15 180deg)
//    oklch(0.65 0.22 180 / 55%)
//    oklch(0.65 none 180)       → c = null
// ═══════════════════════════════════════════
function parseOklch(str) {
  if (typeof str !== 'string') return null

  // 标准化：去掉多余空格，统一大小写
  const s = str.trim()

  // 匹配 oklch(...)
  const fnMatch = s.match(/^oklch\(\s*(.+)\s*\)$/i)
  if (!fnMatch) return null

  const inner = fnMatch[1]
  // 按 '/' 分割（如果存在 alpha）
  const slashIdx = findSlash(inner)
  const colorPart = slashIdx >= 0 ? inner.slice(0, slashIdx) : inner
  const alphaRaw = slashIdx >= 0 ? inner.slice(slashIdx + 1).trim() : null

  // 分割 L C H（按空白）
  const parts = colorPart.split(/\s+/).filter(Boolean)
  if (parts.length < 3) return null

  const l = parseCssNumber(parts[0])
  const c = parseCssNumberOrNone(parts[1])
  const h = parseCssNumber(parts[2])  // hue 支持 deg

  if (l === null && h === null) return null

  const alpha = alphaRaw ? parseCssNumber(alphaRaw) : null

  return { l: l ?? 0, c, h: h ?? 0, alpha }
}

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
  if (s === 'none') return null  // none → null（缺失值）
  // 去掉 deg 后缀
  const degStripped = s.replace(/deg$/i, '')
  // 百分比
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

// ═══════════════════════════════════════════
//  颜色语义描述引擎
// ═══════════════════════════════════════════

const ACHROMATIC_THRESHOLD = 0.02  // c < 此值视为无彩色

function getHueKey(hue) {
  for (const seg of HUE_SEGMENTS) {
    if (hue <= seg.max) return seg.key
  }
  return 'red'
}

/**
 * 分析颜色，返回结构化语义特征
 * @returns {{ achromatic: true, l: number, alpha: number|null }
 *         | { achromatic: false, hueKey: string, sat: string, bri: string, alpha: string|null, l: number, c: number, alphaVal: number|null }}
 */
function analyzeColor(colorStr) {
  const parsed = parseOklch(colorStr)
  if (!parsed) return null

  const { l, c, h, alpha: alphaVal } = parsed

  // ── achromatic 判断 ──
  if (c === null || c < ACHROMATIC_THRESHOLD) {
    return { achromatic: true, l: l ?? 0.5, alpha: alphaVal }
  }

  // ── chromatic ──
  const hueKey = getHueKey(h ?? 0)
  const hueName = hueKey  // key，由 formatter 查词典

  // 饱和度
  let sat = ''
  if (c < 0.04) sat = 'muted'
  else if (c > 0.15) sat = 'vivid'
  // 0.04~0.15: moderate → 不标注

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

/**
 * 生成语义颜色描述
 * @param {'zh'|'en'} locale
 * @param {'brief'|'full'} verbosity
 */
function describeColor(colorStr, locale = 'zh', verbosity = 'full') {
  const fmt = FORMATTERS[locale] || FORMATTERS.zh
  const analysis = analyzeColor(colorStr)
  if (!analysis) return colorStr

  // ── brief 模式 ──
  if (verbosity === 'brief') {
    if (analysis.achromatic) return fmt.achromatic(analysis.l)
    // brief: 只返回色相名（不拼接修饰词）
    const labels = HUE_LABELS[locale] || HUE_LABELS.zh
    return labels[analysis.hueKey] || analysis.hueKey
  }

  // ── full 模式 ──
  if (analysis.achromatic) {
    let base = fmt.achromatic(analysis.l)
    // 如果有透明度，附加
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
//  触发器 aria-label（full 模式，跟随 locale）
// ═══════════════════════════════════════════
const triggerLabel = computed(() => {
  const loc = props.locale || 'zh'
  const ui = UI_LABELS[loc] || UI_LABELS.zh
  const desc = describeColor(props.modelValue, loc, 'full')
  const analysis = analyzeColor(props.modelValue)
  let extra = ''
  if (analysis && analysis.alphaVal !== null && analysis.alphaVal < 0.95) {
    const pct = Math.round(analysis.alphaVal * 100)
    extra = ui.alphaPercent(pct)
  }
  return ui.currentColor(desc, extra, props.modelValue)
})

// ── 网格 aria-label ──
const gridAriaLabel = computed(() => {
  const loc = props.locale || 'zh'
  const ui = UI_LABELS[loc] || UI_LABELS.zh
  return ui.colorPicker(GRID.innerCol, GRID.innerRow)
})

// ═══════════════════════════════════════════
//  静态点数据（颜色 + 坐标；ariaLabel 动态计算）
// ═══════════════════════════════════════════
const dotsData = []

{
  const { innerCol, innerRow, pad, col, row, step, dotSize } = GRID
  for (let i = 0; i < col * row; i++) {
    const cx = i % col
    const cy = Math.floor(i / col)
    const border = cx < pad || cx >= col - pad || cy < pad || cy >= row - pad

    let color, hue, alpha, hueKey
    if (border) {
      color = 'transparent'
      hue = null
      alpha = null
      hueKey = null
    } else {
      const ix = cx - pad
      const iy = cy - pad
      hue = (ix / innerCol) * 360
      alpha = (0.9 / innerRow) * iy + 0.1
      color = `oklch(0.65 0.22 ${hue} / ${alpha})`
      hueKey = getHueKey(hue)
    }

    dotsData.push({
      color,
      isTransparent: border,
      hue,
      alpha,
      hueKey,
      x: cx * step + dotSize / 2,
      y: cy * step + dotSize / 2,
    })
  }
}

/**
 * 动态计算 gridcell 的 aria-label（跟随 locale）
 */
function getCellAriaLabel(dot) {
  const loc = props.locale || 'zh'
  const ui = UI_LABELS[loc] || UI_LABELS.zh
  if (dot.isTransparent) return ui.transparent
  const labels = HUE_LABELS[loc] || HUE_LABELS.zh
  const name = labels[dot.hueKey] || dot.hueKey
  if (dot.alpha < 0.3) return ui.lowAlpha(name)
  return name
}

// ═══════════════════════════════════════════
//  查找点
// ═══════════════════════════════════════════
function findDotByHue(targetHue) {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < dotsData.length; i++) {
    if (dotsData[i].isTransparent) continue
    const dist = Math.abs(dotsData[i].hue - targetHue)
    if (dist < bestDist) { bestDist = dist; best = i }
  }
  return best
}

function findDotByColor(colorStr) {
  for (let i = 0; i < dotsData.length; i++) {
    if (dotsData[i].color === colorStr) return i
  }
  const parsed = parseOklch(colorStr)
  if (parsed) return findDotByHue(parsed.h)
  return -1
}

function activeIndexOf(rowIdx, colIdx) {
  const clampedRow = Math.max(GRID.pad, Math.min(GRID.row - GRID.pad - 1, rowIdx))
  const clampedCol = Math.max(GRID.pad, Math.min(GRID.col - GRID.pad - 1, colIdx))
  return clampedRow * GRID.col + clampedCol
}

// ═══════════════════════════════════════════
//  键盘焦点状态
// ═══════════════════════════════════════════
const focusedIndex = ref(-1)
const selectedDotIndex = ref(-1)

watch(() => props.modelValue, (val) => {
  selectedDotIndex.value = findDotByColor(val)
}, { immediate: true })

// ═══════════════════════════════════════════
//  运行时缓存
// ═══════════════════════════════════════════
const dotCache = []
let rafId = null
let pointerX = 0
let pointerY = 0
let currentHoverColor = ''
const popupStyle = ref({})

// ═══════════════════════════════════════════
//  视觉高亮
// ═══════════════════════════════════════════
function highlightDot(index) {
  for (const dot of dotCache) {
    dot.el.style.transform = `scale(${GRID.baseScale})`
  }
  if (index >= 0 && index < dotCache.length && !dotsData[index].isTransparent) {
    dotCache[index].el.style.transform = `scale(${GRID.maxScale})`
    currentHoverColor = dotsData[index].color
    if (popupRef.value) popupRef.value.style.borderColor = dotsData[index].color
  } else {
    currentHoverColor = ''
    if (popupRef.value) popupRef.value.style.borderColor = ''
  }
}

function clearHighlight() {
  for (const dot of dotCache) dot.el.style.transform = `scale(${GRID.baseScale})`
  currentHoverColor = ''
  if (popupRef.value) popupRef.value.style.borderColor = ''
}

// ═══════════════════════════════════════════
//  键盘导航
// ═══════════════════════════════════════════
function navigateTo(index) {
  focusedIndex.value = index
  highlightDot(index)
  nextTick(() => {
    const el = dotCache[index]?.el
    if (el) el.focus()
  })
}

function onGridKeydown(e, currentIndex) {
  const col = currentIndex % GRID.col
  const row = Math.floor(currentIndex / GRID.col)

  let newIndex = currentIndex

  switch (e.key) {
    case 'ArrowLeft':
    case 'Left':
      newIndex = activeIndexOf(row, col - 1)
      break
    case 'ArrowRight':
    case 'Right':
      newIndex = activeIndexOf(row, col + 1)
      break
    case 'ArrowUp':
    case 'Up':
      newIndex = activeIndexOf(row - 1, col)
      break
    case 'ArrowDown':
    case 'Down':
      newIndex = activeIndexOf(row + 1, col)
      break
    case 'Home':
      newIndex = activeIndexOf(row, GRID.pad)
      break
    case 'End':
      newIndex = activeIndexOf(row, GRID.col - GRID.pad - 1)
      break
    case 'Enter':
    case ' ':
    case 'Space':
      e.preventDefault()
      selectColor()
      return
    case 'Escape':
      close()
      return
    default:
      return
  }

  if (newIndex !== currentIndex) {
    e.preventDefault()
    navigateTo(newIndex)
  }
}

function onDotFocus(index) {
  if (focusedIndex.value !== index) {
    focusedIndex.value = index
    highlightDot(index)
  }
}

function onGridBlur(e) {
  if (!gridRef.value?.contains(e.relatedTarget)) {
    close()
  }
}

// ═══════════════════════════════════════════
//  初始化键盘焦点
// ═══════════════════════════════════════════
function initFocusedIndex() {
  let idx = selectedDotIndex.value
  if (idx < 0 || dotsData[idx].isTransparent) {
    const parsed = parseOklch(props.modelValue)
    idx = parsed ? findDotByHue(parsed.h) : findDotByHue(180)
  }
  if (idx < 0 || dotsData[idx].isTransparent) {
    const midRow = Math.floor(GRID.row / 2)
    const midCol = Math.floor(GRID.col / 2)
    idx = midRow * GRID.col + midCol
  }
  return idx
}

// ═══════════════════════════════════════════
//  打开 / 关闭
// ═══════════════════════════════════════════
function toggle() {
  open.value = !open.value
}

function close() {
  if (!open.value) return
  open.value = false
  focusedIndex.value = -1
  clearHighlight()
  nextTick(() => triggerRef.value?.focus())
}

// ═══════════════════════════════════════════
//  生命周期
// ═══════════════════════════════════════════
watch(open, async (val) => {
  if (val) {
    await nextTick()
    if (!gridRef.value) return

    dotCache.length = 0
    const dots = gridRef.value.children
    for (let i = 0; i < dots.length; i++) {
      dotCache.push({ ...dotsData[i], el: dots[i] })
    }
    updatePopupPosition()

    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)

    const idx = initFocusedIndex()
    focusedIndex.value = idx
    highlightDot(idx)
    nextTick(() => {
      const el = dotCache[idx]?.el
      if (el) el.focus()
    })
  } else {
    window.removeEventListener('resize', updatePopupPosition)
    window.removeEventListener('scroll', updatePopupPosition, true)
    focusedIndex.value = -1
  }
})

// ═══════════════════════════════════════════
//  自适应定位
// ═══════════════════════════════════════════
function updatePopupPosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const { bottom, left, top: triggerTop } = trigger.getBoundingClientRect()
  const gap = 8

  let top = bottom + gap
  let panelLeft = left

  if (top + 300 > window.innerHeight - 16) {
    top = triggerTop - gap - 300
    if (top < 16) top = 16
  }
  if (panelLeft + 320 > window.innerWidth - 16) {
    panelLeft = window.innerWidth - 320 - 16
  }
  if (panelLeft < 16) panelLeft = 16

  popupStyle.value = { top: `${top}px`, left: `${panelLeft}px` }
}

// ═══════════════════════════════════════════
//  点阵交互（鼠标 / 触摸）
// ═══════════════════════════════════════════
function onPointer(x, y) {
  pointerX = x
  pointerY = y
  if (!rafId) rafId = requestAnimationFrame(render)
}

function render() {
  rafId = null
  const grid = gridRef.value
  if (!grid) return

  const { left, top, right, bottom } = grid.getBoundingClientRect()

  if (pointerX < left || pointerX > right || pointerY < top || pointerY > bottom) {
    for (const dot of dotCache) dot.el.style.transform = `scale(${GRID.baseScale})`
    currentHoverColor = ''
    if (popupRef.value) popupRef.value.style.borderColor = ''
    return
  }

  const mx = pointerX - left
  const my = pointerY - top

  let minDist = Infinity
  let nearest = null

  for (const dot of dotCache) {
    const dist = Math.hypot(mx - dot.x, my - dot.y)

    if (!dot.isTransparent && dist < minDist) {
      minDist = dist
      nearest = dot.color
    }

    dot.el.style.transform =
      dist >= GRID.radius
        ? `scale(${GRID.baseScale})`
        : `scale(${GRID.baseScale + (GRID.maxScale - GRID.baseScale) * (1 - dist / GRID.radius)})`
  }

  currentHoverColor = nearest ?? ''
  if (popupRef.value) {
    popupRef.value.style.borderColor = nearest ?? ''
  }
}

function onTouchEnd(e) {
  const grid = gridRef.value
  if (grid) {
    const touch = e.changedTouches[0]
    const rect = grid.getBoundingClientRect()
    if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
      selectColor()
    }
  }
  handleLeave()
}

function handleLeave() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  for (const dot of dotCache) dot.el.style.transform = `scale(${GRID.baseScale})`
  currentHoverColor = ''
  if (popupRef.value) popupRef.value.style.borderColor = ''
}

function selectColor() {
  if (currentHoverColor) { emit('update:modelValue', currentHoverColor); close() }
}

// ═══════════════════════════════════════════
//  全局 Escape
// ═══════════════════════════════════════════
function onKeydown(e) { if (e.key === 'Escape' && open.value) close() }

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updatePopupPosition)
  window.removeEventListener('scroll', updatePopupPosition, true)
})
</script>

<style scoped>
.color-dot {
  will-change: transform;
  transform: translateZ(0);
}

.color-dot:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 50%;
}

/* ── 动画 ── */
.popup-enter-active {
  transition: opacity 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
              transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.popup-leave-active {
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: scale(0.7);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  .color-dot {
    will-change: auto;
    transition: none;
    animation: none;
  }
  .popup-enter-active,
  .popup-leave-active {
    transition: none !important;
  }
  .popup-enter-from,
  .popup-leave-to {
    opacity: 1;
    transform: none;
  }
  .fade-enter-active,
  .fade-leave-active {
    transition: none !important;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 1;
  }
}
</style>
