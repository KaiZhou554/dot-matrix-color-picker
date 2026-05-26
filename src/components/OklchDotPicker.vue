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
      <!-- 遮罩 -->
      <Transition name="fade">
        <div
          v-if="open"
          class="fixed inset-0 z-40 bg-black/5"
          @click="close"
        />
      </Transition>

      <!-- 面板 -->
      <Transition
        name="popup"
        @before-enter="beforeEnter"
        @enter="enter"
        @leave="leave"
      >
        <div
          v-if="open"
          ref="popupRef"
          class="popup-panel fixed z-50 w-fit rounded-2xl px-6 py-5
                 border-3 border-gray-200 dark:border-gray-600 font-sans
                 transition-colors duration-150
                 bg-white dark:bg-gray-800"
          :style="popupStyle"
        >
          <!-- 点阵区域 -->
          <div
            ref="gridRef"
            class="color-grid grid gap-2.5 touch-none"
            :style="{ gridTemplateColumns: `repeat(${col}, 1fr)` }"
            @mousemove="handleMove"
            @mouseup="selectColor"
            @mouseleave="handleLeave"
            @mousedown.stop
            @touchstart.prevent="handleTouch"
            @touchmove.prevent="handleTouch"
            @touchend="handleLeave"
            @touchcancel="handleLeave"
          >
            <div
              v-for="(item, index) in dotList"
              :key="index"
              class="color-dot w-1 h-1 rounded-full"
              :style="{ backgroundColor: item.color }"
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
  modelValue: {
    type: String,
    default: '#3b82f6',
  },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const gridRef = ref(null)
const popupRef = ref(null)
const dotList = ref([])
const triggerRef = ref(null)

// 配置
const col = 16
const row = 10
const baseScale = 1
const maxScale = 3.5
const effectiveRadius = 60

// 网格布局参数（与 CSS 保持一致：w-1=4px, gap-2.5=10px）
const DOT_SIZE = 4
const DOT_GAP = 10
const DOT_STEP = DOT_SIZE + DOT_GAP // 14px

// 缓存
const dotCache = []

// RAF
let rafId = null
let pointerX = 0
let pointerY = 0
let currentHoverColor = '#e5e7eb'

// 弹出位置
const popupStyle = ref({})

// 生成颜色
function generateColor(index) {
  const x = index % col
  const y = Math.floor(index / col)
  const hue = (x / col) * 360
  const light = 0.65
  const chroma = 0.22
  const alpha = (0.9 / row) * y + 0.1
  return { color: `oklch(${light} ${chroma} ${hue} / ${alpha})` }
}

// 初始化点阵数据
onMounted(async () => {
  const list = []
  for (let i = 0; i < col * row; i++) {
    list.push(generateColor(i))
  }
  dotList.value = list
})

// 打开时缓存点引用和计算坐标（纯数学计算，不受 CSS transform 影响）
watch(open, async (val) => {
  if (!val) return
  await nextTick()
  if (!gridRef.value) return

  dotCache.length = 0
  const dots = gridRef.value.children

  for (let i = 0; i < dots.length; i++) {
    const colIdx = i % col
    const rowIdx = Math.floor(i / col)
    dotCache.push({
      el: dots[i],
      color: dotList.value[i]?.color ?? '#e5e7eb',
      x: colIdx * DOT_STEP + DOT_SIZE / 2,
      y: rowIdx * DOT_STEP + DOT_SIZE / 2,
    })
  }

  // 计算弹出位置
  updatePopupPosition()
})

// 更新弹出位置
function updatePopupPosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const gap = 8

  // 默认在触发器下方
  let top = rect.bottom + gap
  let left = rect.left

  // 如果下方空间不够，放到上方
  const panelH = 300 // 预估高度
  if (top + panelH > window.innerHeight - 16) {
    top = rect.top - gap - panelH
    if (top < 16) top = 16
  }

  // 如果右侧空间不够，向左调整
  const panelW = 320 // 预估宽度
  if (left + panelW > window.innerWidth - 16) {
    left = window.innerWidth - panelW - 16
  }
  if (left < 16) left = 16

  popupStyle.value = { top: `${top}px`, left: `${left}px` }
}

// 切换
function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

// --- 过渡动画钩子 ---
function beforeEnter(el) {
  el.style.opacity = '0'
  el.style.transform = 'scale(0.7)'
}

function enter(el, done) {
  el.offsetHeight // 强制回流
  el.style.transition = 'opacity 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
  el.style.opacity = '1'
  el.style.transform = 'scale(1)'
  el.addEventListener('transitionend', done, { once: true })
}

function leave(el, done) {
  el.style.transition = 'opacity 0.15s ease-in, transform 0.15s ease-in'
  el.style.opacity = '0'
  el.style.transform = 'scale(0.7)'
  el.addEventListener('transitionend', done, { once: true })
}

// 缩放渲染
function render() {
  rafId = null
  const grid = gridRef.value
  if (!grid) return

  const rect = grid.getBoundingClientRect()
  const mx = pointerX - rect.left
  const my = pointerY - rect.top

  let minDist = Infinity

  for (const dot of dotCache) {
    const dx = mx - dot.x
    const dy = my - dot.y
    const dist = Math.hypot(dx, dy)

    if (dist < minDist) {
      minDist = dist
      currentHoverColor = dot.color
    }

    const scale =
      dist >= effectiveRadius
        ? baseScale
        : baseScale + (maxScale - baseScale) * (1 - dist / effectiveRadius)

    dot.el.style.transform = `scale(${scale})`
  }

  // 更新面板边框颜色
  if (popupRef.value) {
    popupRef.value.style.borderColor = currentHoverColor
  }
}

function handleMove(e) {
  pointerX = e.clientX
  pointerY = e.clientY
  if (!rafId) rafId = requestAnimationFrame(render)
}

function handleTouch(e) {
  const t = e.touches[0]
  pointerX = t.clientX
  pointerY = t.clientY
  if (!rafId) rafId = requestAnimationFrame(render)
}

function handleLeave() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  for (const dot of dotCache) {
    dot.el.style.transform = `scale(${baseScale})`
  }
  currentHoverColor = '#e5e7eb'
  // 清除 inline borderColor，让 CSS class 接管深浅色默认边框
  if (popupRef.value) {
    popupRef.value.style.borderColor = ''
  }
}

// 点击选中
function selectColor(e) {
  if (currentHoverColor && currentHoverColor !== '#e5e7eb') {
    emit('update:modelValue', currentHoverColor)
    close()
  }
}

// 键盘关闭
function onKeydown(e) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
/* 难以用 Tailwind 精确表达的样式保留在此 */

.color-dot {
  will-change: transform;
  transform: translateZ(0);
  transition: transform 0.06s linear;
}

.popup-panel {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

/* 遮罩淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
