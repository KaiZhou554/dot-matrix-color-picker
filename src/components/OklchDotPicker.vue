<template>
    <div
        ref="cardRef"
        class="oklch-dot-picker-card dark:bg-gray-800"
    >
        <!-- 点阵区域 -->
        <div
            ref="gridRef"
            class="color-grid"
            @mousemove="handleMove"
            @mouseleave="handleLeave"
            @touchstart.prevent="handleTouch"
            @touchmove.prevent="handleTouch"
            @touchend="handleLeave"
            @touchcancel="handleLeave"
        >
            <div
                v-for="(item, index) in dotList"
                :key="index"
                class="color-dot"
                :style="{ backgroundColor: item.color }"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'

const gridRef = ref(null)
const cardRef = ref(null)
const dotList = ref([])

// 配置
const col = 16
const row = 10
const baseScale = 1
const maxScale = 3.5
const effectiveRadius = 60

// 缓存点数据（避免反复读取布局）
const dotCache = []

// RAF
let rafId = null
let pointerX = 0
let pointerY = 0

// 生成颜色
function generateColor(index) {
    const x = index % col
    const y = Math.floor(index / col)

    const hue = (x / col) * 360
    const light = 0.65
    const chroma = 0.22
    const alpha = (0.9 / row) * y + 0.1

    return {
        color: `oklch(${light} ${chroma} ${hue} / ${alpha})`,
    }
}


// 初始化
onMounted(async () => {
    const list = []

    for (let i = 0; i < col * row; i++) {
        list.push(generateColor(i))
    }

    dotList.value = list

    await nextTick()

    const gridRect = gridRef.value.getBoundingClientRect()
    const dots = gridRef.value.children

    // 只测量一次
    for (let i = 0; i < dots.length; i++) {
        const dot = dots[i]
        const rect = dot.getBoundingClientRect()

        dotCache.push({
            el: dot,
            color: list[i].color,

            // 缓存真实中心坐标
            x: rect.left - gridRect.left + rect.width / 2,
            y: rect.top - gridRect.top + rect.height / 2,
        })
    }
})
// 真正渲染
function render() {
    rafId = null

    const grid = gridRef.value
    if (!grid) return

    const rect = grid.getBoundingClientRect()

    const mx = pointerX - rect.left
    const my = pointerY - rect.top

    let minDist = Infinity
    let nearestColor = '#e5e7eb'

    for (const dot of dotCache) {
        const dx = mx - dot.x
        const dy = my - dot.y

        const dist = Math.hypot(dx, dy)

        if (dist < minDist) {
            minDist = dist
            nearestColor = dot.color
        }

        const scale =
            dist >= effectiveRadius
                ? baseScale
                : baseScale +
                  (maxScale - baseScale) *
                      (1 - dist / effectiveRadius)

        dot.el.style.transform = `scale(${scale})`
    }

    // 直接操作 DOM，避免 Vue 高频响应式更新
    cardRef.value.style.borderColor = nearestColor
}

// 鼠标移动
function handleMove(e) {
    pointerX = e.clientX
    pointerY = e.clientY

    if (!rafId) {
        rafId = requestAnimationFrame(render)
    }
}

// 触摸
function handleTouch(e) {
    const t = e.touches[0]

    pointerX = t.clientX
    pointerY = t.clientY

    if (!rafId) {
        rafId = requestAnimationFrame(render)
    }
}

// 离开
function handleLeave() {
    cancelAnimationFrame(rafId)
    rafId = null

    for (const dot of dotCache) {
        dot.el.style.transform = `scale(${baseScale})`
    }

    cardRef.value.style.borderColor = '#e5e7eb'
}
</script>

<style scoped>
.oklch-dot-picker-card {
    width: fit-content;
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 3px solid #e5e7eb;
    transition: border-color 0.15s linear;
    font-family: system-ui, sans-serif;
}

.color-grid {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 10px;
    touch-action: none;
}

.color-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;

    /* 性能优化 */
    will-change: transform;
    transform: translateZ(0);

    /* 不要太长 */
    transition: transform 0.06s linear;
}
</style>