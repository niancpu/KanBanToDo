import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

const visible = ref(false)
const message = ref('')
const type = ref<ToastType>('info')
const timeout = ref(3000)

export function useToast() {
  const show = (msg: string, t: ToastType = 'info', ms = 3000) => {
    message.value = msg
    type.value = t
    timeout.value = ms
    visible.value = true
  }

  const success = (msg: string) => show(msg, 'success')
  const error = (msg: string) => show(msg, 'error', 5000)
  const info = (msg: string) => show(msg, 'info')
  const warning = (msg: string) => show(msg, 'warning', 4000)

  return { visible, message, type, timeout, show, success, error, info, warning }
}
