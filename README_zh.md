# dot-matrix-color-picker

[English](README.md) | 简体中文

基于 OKLCH 色彩空间的点阵式颜色选择器，Vue 3 组件。

## 特性

- **OKLCH 色彩空间** — 感知均匀的色相 / 饱和度 / 亮度分布，选色更直观
- **点阵交互** — 悬停放大最近点并实时预览，点击选中
- **触摸支持** — 同时适配鼠标与触屏拖拽操作
- **深色模式** — 自动跟随系统偏好，亮 / 暗主题无缝切换
- **自适应定位** — 面板自动避开视口边缘，窗口大小变化时跟随触发器
- **无障碍键盘模式** — Tab / 方向键导航，屏幕阅读器友好，支持中/英双语

## 技术栈

- Vue 3（Composition API）
- Vite
- CSS 过渡动画

## 使用

`OklchDotPickerAccessible.vue` 包含了完整的无障碍和本地化功能，推荐使用。  
`OklchDotPickerLite.vue` 是轻量版，不包含无障碍支持。

```vue
<script setup>
import { ref } from 'vue'
import OklchDotPickerAccessible from './components/OklchDotPickerAccessible.vue'

const color = ref('oklch(0.65 0.22 180 / 0.55)')
</script>

<template>
  <OklchDotPickerAccessible v-model="color" />
</template>
```

### Props

| Prop         | 类型   | 默认值       | 说明                     |
| ------------ | ------ | ------------ | ------------------------ |
| modelValue   | String | `'#3b82f6'`  | 当前选中颜色值           |
| locale       | String | `'zh-CN'`    | 无障碍功能的语言         |
| confirmColor | String | `'#3b82f6'`  | 键盘模式下完成按钮的颜色 |

### Events

| Event              | 参数   | 说明               |
| ------------------ | ------ | ------------------ |
| update:modelValue  | String | 用户点击选中新颜色 |

## 项目设置

```sh
npm install
```

### 开发

```sh
npm run dev
```

### 构建

```sh
npm run build
```
