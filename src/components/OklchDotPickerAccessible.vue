<template>
  <div class="oklch-picker relative inline-block">
    <!-- 触发器：通过 :focus-visible 判断交互方式 -->
    <button
      ref="triggerRef"
      class="w-10 h-10 rounded-lg border-3 border-gray-200 dark:border-gray-600 cursor-pointer
             transition-colors duration-150 outline-none
             focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      :style="{ backgroundColor: modelValue }"
      :aria-label="triggerAriaLabel"
      @click="onTriggerClick"
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
          class="shadow-lg fixed z-50 w-fit rounded-xl
                 border border-gray-200 dark:border-gray-600 font-sans
                 transition-colors duration-150
                 bg-white dark:bg-gray-800"
          :style="popupStyle"
        >
          <!-- 顶部颜色预览条（两模式共用） -->
          <div
            class="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-gray-200 dark:border-gray-600"
          >
            <div
              class="w-5 h-5 rounded shrink-0 ring-1 ring-inset ring-black/10 dark:ring-white/20"
              :style="{ backgroundColor: displayColor }"
            />
            <span
              class="font-mono text-xs leading-none tracking-tighter text-gray-600 dark:text-gray-300 whitespace-nowrap select-none"
            >{{ displayOklch }}</span>
          </div>

          <!-- ── Pointer 模式：点阵（与原行为一致） ── -->
          <div
            v-if="modality === 'pointer'"
            ref="gridRef"
            class="color-grid grid gap-2.5 touch-none"
            role="none"
            :style="{ gridTemplateColumns: `repeat(${GRID.col}, 1fr)` }"
            @mousemove="onPointer($event.clientX, $event.clientY)"
            @mouseup="selectColor"
            @mouseleave="handleLeave"
            @mousedown.stop
            @touchstart.prevent="onPointer($event.touches[0].clientX, $event.touches[0].clientY)"
            @touchmove.prevent="onPointer($event.touches[0].clientX, $event.touches[0].clientY)"
            @touchend="onTouchEnd"
            @touchcancel="handleLeave"
          >
            <div
              v-for="(dot, index) in dotsData"
              :key="index"
              class="color-dot w-1 h-1 rounded-full"
              :style="{ backgroundColor: dot.color }"
              aria-hidden="true"
            />
          </div>

          <!-- ── Keyboard 模式：色相 + 透明度 + 完成按钮 ── -->
          <div
            v-else
            class="flex flex-col gap-3 p-3.5 min-w-[260px] outline-none"
            role="group"
            :aria-label="t('colorAdjust')"
            @keydown="onKbKeydown"
          >
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('hue') }}</span>
            <div class="flex" role="radiogroup" :aria-label="t('hue')">
              <button
                v-for="(opt, i) in hueOptions"
                :key="opt.hue"
                role="radio"
                :tabindex="kbFocusIndex === i ? 0 : -1"
                :aria-checked="keyHue === opt.hue"
                :aria-label="opt.label"
                class="flex-1 h-9 cursor-pointer outline-none
                       focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-blue-400
                       border border-gray-300 dark:border-gray-600
                       transition-all relative"
                :class="[
                  i === 0 ? 'rounded-l-lg' : '',
                  i === hueOptions.length - 1 ? 'rounded-r-lg' : '',
                  i > 0 ? '-ml-px' : '',
                ]"
                :style="{ backgroundColor: opt.color }"
                @click="pickHue(opt.hue)"
                @focus="kbFocusIndex = i"
              >
                <span
                  v-if="keyHue === opt.hue"
                  class="absolute inset-0 flex items-center justify-center
                         text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]
                         dark:text-black dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]
                         text-sm font-bold pointer-events-none"
                >✓</span>
              </button>
            </div>

            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('alpha') }}</span>
            <div class="flex" role="radiogroup" :aria-label="t('alpha')">
              <button
                v-for="(a, i) in alphaOptions"
                :key="a"
                role="radio"
                :tabindex="kbFocusIndex === i + 8 ? 0 : -1"
                :aria-checked="Math.abs(keyAlpha - a) < 0.02"
                :aria-label="t('alphaValue', { pct: Math.round(a * 100), desc: alphaDesc(a) })"
                class="flex-1 h-9 cursor-pointer outline-none overflow-hidden
                       focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-blue-400
                       border border-gray-300 dark:border-gray-600
                       transition-all relative"
                :class="[
                  i === 0 ? 'rounded-l-lg' : '',
                  i === alphaOptions.length - 1 ? 'rounded-r-lg' : '',
                  i > 0 ? '-ml-px' : '',
                ]"
                :style="{ background: alphaBg(a), backgroundSize: '100% 100%, 8px 8px' }"
                @click="pickAlpha(a)"
                @focus="kbFocusIndex = i + 8"
              >
                <span
                  v-if="Math.abs(keyAlpha - a) < 0.02"
                  class="absolute inset-0 flex items-center justify-center
                         text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]
                         dark:text-black dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]
                         text-sm font-bold pointer-events-none"
                >✓</span>
              </button>
            </div>

            <!-- 完成按钮 -->
            <button
              :tabindex="kbFocusIndex === 12 ? 0 : -1"
              class="w-full h-8 rounded-lg text-white text-xs font-medium cursor-pointer mt-2
                     outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1
                     transition-opacity hover:opacity-90"
              :style="{ backgroundColor: confirmColor }"
              @click="commitColor"
              @focus="kbFocusIndex = 12"
            >{{ t('done') }}</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { parseOklch } from '../utils/oklch.js'

const props = defineProps({
  modelValue: { type: String, default: '#3b82f6' },
  locale: { type: String, default: 'zh-CN' },
  confirmColor: { type: String, default: '#3b82f6' },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const modality = ref('pointer') // 'pointer' | 'keyboard'
const gridRef = ref(null)
const popupRef = ref(null)
const triggerRef = ref(null)

// ═══════════════════════════════════════════
//  i18n 词典（遵循 useColorSemantics 风格）
// ═══════════════════════════════════════════

const HUE_NAMES = {
  'zh-CN': { red:'红色', orange:'橙色', yellow:'黄色', green:'绿色', cyan:'青色', blue:'蓝色', purple:'紫色', pink:'粉色' },
  en: { red:'red', orange:'orange', yellow:'yellow', green:'green', cyan:'cyan', blue:'blue', purple:'purple', pink:'pink' },
}

const UI = {
  'zh-CN': {
    colorAdjust: '颜色调整',
    hue: '色相',
    alpha: '透明度',
    transparent: '透明',
    opaque: '不透明',
    alphaValue: ({ pct, desc }) => `${desc}，透明度 ${pct}%`,
    colorBtn: ({ desc }) => `当前颜色：${desc}`,
    done: '完成',
  },
  en: {
    colorAdjust: 'Color adjustment',
    hue: 'Hue',
    alpha: 'Opacity',
    transparent: 'Transparent',
    opaque: 'Opaque',
    alphaValue: ({ pct, desc }) => `${desc}, ${pct}% opacity`,
    colorBtn: ({ desc }) => `Current color: ${desc}`,
    done: 'Done',
  },
}

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

function getHueKey(h) {
  for (const seg of HUE_SEGMENTS) {
    if (h <= seg.max) return seg.key
  }
  return 'red'
}

function t(key, params) {
  const dict = UI[props.locale] || UI['zh-CN']
  const val = dict[key]
  return typeof val === 'function' ? val(params || {}) : val
}

function hueLabel(key) {
  const dict = HUE_NAMES[props.locale] || HUE_NAMES['zh-CN']
  return dict[key] || key
}

const ALPHA_DESC = {
  'zh-CN': ['高度透明', '半透明', '略透明', '不透明'],
  en: ['highly transparent', 'semi-transparent', 'slightly transparent', 'opaque'],
}

function alphaDesc(a) {
  const idx = a < 0.35 ? 0 : a < 0.6 ? 1 : a < 0.85 ? 2 : 3
  const dict = ALPHA_DESC[props.locale] || ALPHA_DESC['zh-CN']
  return dict[idx]
}

function alphaBg(a) {
  const g = Math.round(120 * a + 80)
  return `linear-gradient(rgba(${g},${g},${g},${a}), rgba(${g},${g},${g},${a})), repeating-conic-gradient(#d4d4d4 0% 25%, transparent 0% 50%)`
}

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
//  静态点数据
// ═══════════════════════════════════════════
const dotsData = []

{
  const { innerCol, innerRow, pad, col, row, step, dotSize } = GRID
  for (let i = 0; i < col * row; i++) {
    const cx = i % col
    const cy = Math.floor(i / col)
    const border = cx < pad || cx >= col - pad || cy < pad || cy >= row - pad

    let color
    if (border) {
      color = 'transparent'
    } else {
      const ix = cx - pad
      const iy = cy - pad
      const hue = (ix / innerCol) * 360
      const alpha = (0.9 / innerRow) * iy + 0.1
      color = `oklch(0.65 0.22 ${hue} / ${alpha})`
    }

    dotsData.push({
      color,
      isTransparent: border,
      x: cx * step + dotSize / 2,
      y: cy * step + dotSize / 2,
    })
  }
}

// ═══════════════════════════════════════════
//  Keyboard 模式状态
// ═══════════════════════════════════════════
const keyHue = ref(180)
const keyAlpha = ref(0.8)

// 8 色相按钮：每个色段的中点 hue
const hueOptions = computed(() =>
  [
    { hue: 10, key: 'red' },
    { hue: 35, key: 'orange' },
    { hue: 67, key: 'yellow' },
    { hue: 125, key: 'green' },
    { hue: 187, key: 'cyan' },
    { hue: 242, key: 'blue' },
    { hue: 297, key: 'purple' },
    { hue: 340, key: 'pink' },
  ].map(o => ({
    ...o,
    color: `oklch(0.65 0.22 ${o.hue})`,
    label: hueLabel(o.key),
  }))
)

// 4 个透明度级别
const alphaOptions = [0.2, 0.45, 0.7, 1.0]

function refreshKeyboardPreview() {
  const c = `oklch(0.65 0.22 ${keyHue.value} / ${keyAlpha.value})`
  displayColor.value = c
  displayOklch.value = formatOklch(c)
}

function pickHue(h) {
  keyHue.value = h
  refreshKeyboardPreview()
}

function pickAlpha(a) {
  keyAlpha.value = a
  refreshKeyboardPreview()
}

const kbFocusIndex = ref(0)

const ROW_RANGES = [
  { start: 0,  end: 7 },   // hue: 0-7
  { start: 8,  end: 11 },  // alpha: 8-11
  { start: 12, end: 12 },  // confirm: 12
]

function onKbKeydown(e) {
  const cur = kbFocusIndex.value
  let row = ROW_RANGES.findIndex(r => cur >= r.start && cur <= r.end)
  if (row < 0) return

  let next = cur

  switch (e.key) {
    case 'ArrowRight': {
      const r = ROW_RANGES[row]
      if (cur < r.end) next = cur + 1
      break
    }
    case 'ArrowLeft': {
      const r = ROW_RANGES[row]
      if (cur > r.start) next = cur - 1
      break
    }
    case 'ArrowDown': {
      if (row < ROW_RANGES.length - 1) {
        const nr = ROW_RANGES[row + 1]
        next = Math.min(cur + (nr.start - ROW_RANGES[row].start), nr.end)
      }
      break
    }
    case 'ArrowUp': {
      if (row > 0) {
        const pr = ROW_RANGES[row - 1]
        next = Math.min(cur - (ROW_RANGES[row].start - pr.start), pr.end)
      }
      break
    }
    default:
      return
  }

  if (next !== cur) {
    e.preventDefault()
    kbFocusIndex.value = next
    const btns = popupRef.value?.querySelectorAll('[role="group"] button, [role="group"] > button:last-of-type')
    btns?.[next]?.focus()
  }
}

function commitColor() {
  const c = `oklch(0.65 0.22 ${keyHue.value} / ${keyAlpha.value})`
  emit('update:modelValue', c)
  close()
}

// ═══════════════════════════════════════════
//  触发行为
// ═══════════════════════════════════════════
function onTriggerClick() {
  const keyboard = triggerRef.value?.matches(':focus-visible') ?? false
  openModal(keyboard ? 'keyboard' : 'pointer')
}

function openModal(m) {
  if (open.value) { close(); return }
  modality.value = m
  open.value = true
}

function close() {
  if (!open.value) return
  open.value = false
  // 关闭后焦点回到触发器
  nextTick(() => triggerRef.value?.focus())
}

// ═══════════════════════════════════════════
//  顶部预览
// ═══════════════════════════════════════════
function formatOklch(str) {
  const m = str.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\/\s*([\d.]+)\)$/)
  if (!m) return str
  const [, l, c, h, a] = m
  return `oklch(${Number(l).toFixed(2)} ${Number(c).toFixed(2)} ${Number(h).toFixed(1)} / ${Number(a).toFixed(2)})`
}

const displayColor = ref(props.modelValue)
const displayOklch = ref(formatOklch(props.modelValue))

function resetDisplay() {
  displayColor.value = props.modelValue
  displayOklch.value = formatOklch(props.modelValue)
}

// 触发器 aria-label
const triggerAriaLabel = computed(() => {
  const parsed = parseOklch(props.modelValue)
  let desc = props.modelValue
  if (parsed && parsed.h !== null) {
    const key = getHueKey(parsed.h)
    desc = hueLabel(key)
  }
  return t('colorBtn', { desc })
})



// ═══════════════════════════════════════════
//  打开逻辑
// ═══════════════════════════════════════════
watch(open, async (val) => {
  if (val) {
    await nextTick()
    if (!popupRef.value) return

    // 指针模式：初始化点阵 DOM 缓存
    if (modality.value === 'pointer' && gridRef.value) {
      dotCache.length = 0
      const dots = gridRef.value.children
      for (let i = 0; i < dots.length; i++) {
        dotCache.push({ ...dotsData[i], el: dots[i] })
      }
    }

    // 键盘模式：从当前颜色初始化
    if (modality.value === 'keyboard') {
      const parsed = parseOklch(props.modelValue)
      keyHue.value = parsed?.h ?? 180
      keyAlpha.value = parsed?.alpha ?? 0.8
      refreshKeyboardPreview()
    }

    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)

    // 焦点管理：键盘模式 focus 第一个按钮
    if (modality.value === 'keyboard') {
      kbFocusIndex.value = 0
      nextTick(() => {
        const btn = popupRef.value?.querySelector('[role="group"] [tabindex="0"]')
        btn?.focus()
      })
    }
  } else {
    window.removeEventListener('resize', updatePopupPosition)
    window.removeEventListener('scroll', updatePopupPosition, true)
    // 清除网格缓存
    dotCache.length = 0
  }
})

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

const popupStyle = ref({})

// ═══════════════════════════════════════════
//  点阵交互（指针模式）
// ═══════════════════════════════════════════
const dotCache = []
let rafId = null
let pointerX = 0
let pointerY = 0
let currentHoverColor = ''

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
    resetDisplay()
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
  if (nearest) {
    displayColor.value = nearest
    displayOklch.value = formatOklch(nearest)
  } else {
    resetDisplay()
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
  resetDisplay()
}

function selectColor() {
  if (currentHoverColor) { emit('update:modelValue', currentHoverColor); close() }
}

// ═══════════════════════════════════════════
//  全局键盘事件
// ═══════════════════════════════════════════
function onGlobalKeydown(e) {
  if (!open.value) return
  if (e.key === 'Escape') { close() }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', updatePopupPosition)
  window.removeEventListener('scroll', updatePopupPosition, true)
})
</script>

<style scoped>
.color-dot {
  will-change: transform;
  transform: translateZ(0);
  transition: transform 0.06s linear;
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
</style>
