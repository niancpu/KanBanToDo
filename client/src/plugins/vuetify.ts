import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
          background: '#FAFAFA',
          surface: '#FFFFFF',
          // 四象限优先级色（低饱和度）
          'priority-vh': '#E8B4B8', // 重要紧急 — 低饱和红
          'priority-vn': '#B4C5E8', // 重要不紧急 — 低饱和蓝
          'priority-ih': '#E8CEB4', // 不重要紧急 — 低饱和橙
          'priority-in': '#B4E8C0', // 不重要不紧急 — 低饱和绿
        },
      },
    },
  },
  defaults: {
    VCard: { elevation: 1, rounded: 'lg' },
    VBtn: { rounded: 'lg', variant: 'flat' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
  },
})
