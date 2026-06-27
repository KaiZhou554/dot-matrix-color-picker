# dot-matrix-color-picker

English | [简体中文](README_zh.md)

A dot-matrix color picker based on the OKLCH color space, built as a Vue 3 component.

## Features

- **OKLCH color space** — Perceptually uniform hue / saturation / lightness distribution for intuitive color selection
- **Dot-matrix interaction** — Hover to enlarge the nearest dot with real-time preview, click to select
- **Touch support** — Works with both mouse and touch drag operations
- **Dark mode** — Automatically follows system preference, seamless light / dark theme switching
- **Adaptive positioning** — Panel auto-avoids viewport edges and follows the trigger on window resize
- **Accessible keyboard mode** — Tab and arrow-key navigation, screen-reader friendly with i18n (中文 / English)

## Tech Stack

- Vue 3 (Composition API)
- Vite
- CSS transitions & animations

## Usage

`OklchDotPickerAccessible.vue` includes full accessibility and localization.  
`OklchDotPickerLite.vue` is a lightweight version without a11y features.

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

| Prop         | Type   | Default      | Description                              |
| ------------ | ------ | ------------ | ---------------------------------------- |
| modelValue   | String | `'#3b82f6'`  | Currently selected color value           |
| locale       | String | `'zh-CN'`    | Language for a11y labels                 |
| confirmColor | String | `'#3b82f6'`  | Background color of the confirm button   |

### Events

| Event             | Params  | Description                     |
| ----------------- | ------- | ------------------------------- |
| update:modelValue | String  | Emitted when user selects color |

## Setup

```sh
npm install
```

### Development

```sh
npm run dev
```

### Build

```sh
npm run build
```
