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
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, toRef } from 'vue'
import { parseOklch } from '../utils/oklch.js'
import { useColorSemantics } from '../composables/useColorSemantics.js'

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
//  颜色语义 + 无障碍标签
// ═══════════════════════════════════════════
const { triggerLabel, gridAriaLabel, getCellAriaLabel } = useColorSemantics({
  locale: toRef(props, 'locale'),
  colorValue: toRef(props, 'modelValue'),
  gridCols: GRID.innerCol,
  gridRows: GRID.innerRow,
})

// ═══════════════════════════════════════════
//  静态点数据（颜色 + 坐标，一次计算永不变化）
// ═══════════════════════════════════════════
const dotsData = []

{
  const { innerCol, innerRow, pad, col, row, step, dotSize } = GRID
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

  function getHueKey(hue) {
    for (const seg of HUE_SEGMENTS) {
      if (hue <= seg.max) return seg.key
    }
    return 'red'
  }

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
