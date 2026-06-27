<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex items-center justify-center p-6">
    <div class="w-full max-w-lg">
      <!-- 卡片 -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 space-y-6">
        <!-- 标题 -->
        <div class="text-center space-y-1">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            OklchDotPicker
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            悬停点阵预览颜色，点击选中
          </p>
        </div>

        <!-- 选择器 -->
        <div class="flex justify-center">
          <OklchDotPickerAccessible v-model="color" :locale="lang" />
        </div>

        <!-- 语言切换 -->
        <div class="flex justify-center gap-2">
          <button
            class="px-3 py-1 text-xs rounded-md transition-colors"
            :class="lang === 'zh-CN' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
            @click="lang = 'zh-CN'"
          >中文</button>
          <button
            class="px-3 py-1 text-xs rounded-md transition-colors"
            :class="lang === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
            @click="lang = 'en'"
          >English</button>
        </div>

        <p class="text-xs text-gray-400 dark:text-gray-500 text-center -mt-2">
          鼠标点击 · Enter/Space 键盘操作
        </p>

        <!-- 当前颜色信息 -->
        <div class="space-y-3">
          <!-- 颜色预览条 -->
          <div
            class="h-14 rounded-xl border border-gray-200 dark:border-gray-600 transition-colors"
            :style="{ backgroundColor: color }"
          />

          <!-- 颜色值 -->
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
              <span class="text-gray-400 dark:text-gray-500 text-xs">OKLCH</span>
              <p class="text-gray-800 dark:text-gray-200 font-mono text-xs truncate">
                {{ color }}
              </p>
            </div>
            <div class="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
              <span class="text-gray-400 dark:text-gray-500 text-xs">HEX</span>
              <p class="text-gray-800 dark:text-gray-200 font-mono text-xs truncate">
                {{ hexColor }}
              </p>
            </div>
          </div>
        </div>

        <!-- 预设颜色 -->
        <div class="space-y-2">
          <span class="text-xs text-gray-400 dark:text-gray-500">预设</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in presets"
              :key="preset"
              class="w-8 h-8 rounded-md border-2 border-transparent cursor-pointer transition-all hover:scale-110"
              :class="{ 'border-gray-400 dark:border-gray-300': color === preset }"
              :style="{ backgroundColor: preset }"
              @click="color = preset"
            />
          </div>
        </div>
      </div>

      <!-- 页脚 -->
      <p class="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
        系统深色模式自动适配
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import OklchDotPickerAccessible from './OklchDotPickerAccessible.vue'

const color = ref('oklch(0.65 0.22 180 / 0.55)')
const lang = ref('zh-CN')

const presets = [
  'oklch(0.65 0.22 0 / 0.55)',
  'oklch(0.65 0.22 45 / 0.55)',
  'oklch(0.65 0.22 90 / 0.55)',
  'oklch(0.65 0.22 135 / 0.55)',
  'oklch(0.65 0.22 180 / 0.55)',
  'oklch(0.65 0.22 225 / 0.55)',
  'oklch(0.65 0.22 270 / 0.55)',
  'oklch(0.65 0.22 315 / 0.55)',
]

// 将 oklch 转 hex 显示（简易近似）
const hexColor = computed(() => {
  // 用 canvas 转换
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = color.value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return '—'
  }
})
</script>
