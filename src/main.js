import './assets/main.css'

import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'

const i18n = createI18n({
  // 这里是 vue-i18n 的选项 ...
})

createApp(App)
.use(i18n)
.mount('#app')
