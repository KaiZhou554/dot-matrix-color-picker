<template>
  <div class="oklch-picker relative inline-block">
    <!-- 触发器 -->
    <button
      ref="triggerRef"
      class="w-10 h-10 rounded-lg border-3 border-gray-200 dark:border-gray-600 cursor-pointer
             transition-colors duration-150 outline-none
             focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      :style="{ backgroundColor: modelValue }"
      :aria-label="`当前颜色: ${modelValue}`"
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
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '#3b82f6' },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const gridRef = ref(null)
const popupRef = ref(null)
const triggerRef = ref(null)

// ── 网格配置 ──
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

// ── 静态点数据（颜色 + 坐标，一次计算永不变化）──
const dotsData = []

{ // 构建静态数据
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

// ── 运行时缓存（每次打开注入 DOM 引用）──
const dotCache = []

// RAF
let rafId = null
let pointerX = 0
let pointerY = 0
let currentHoverColor = ''
const popupStyle = ref({})

// 打开时注入 DOM 引用 + 定位，并持续跟踪触发器位置
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
  } else {
    window.removeEventListener('resize', updatePopupPosition)
    window.removeEventListener('scroll', updatePopupPosition, true)
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

function toggle() { open.value = !open.value }
function close() { open.value = false }

// ── 点阵交互 ──
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

  // 指针划出网格：立刻重置，模拟 mouseleave 的即时反馈
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

function onKeydown(e) { if (e.key === 'Escape') close() }

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
  transition: transform 0.06s linear;
}

/* ── 动画（纯 CSS，替代 JS 钩子）── */
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
