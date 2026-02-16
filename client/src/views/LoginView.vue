<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="pa-6">
          <v-card-title class="text-h5 text-center mb-4">KanBan ToDo</v-card-title>

          <!-- 验证码步骤 -->
          <v-form v-if="step === 'verify'" @submit.prevent="handleVerify">
            <p class="text-body-2 text-medium-emphasis mb-4">验证码已发送至 {{ registerEmail }}，请查收邮箱。</p>
            <v-text-field v-model="verifyCode" label="验证码" prepend-inner-icon="mdi-shield-key" maxlength="6" autofocus @keyup.enter="handleVerify" />
            <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
            <v-btn type="submit" color="primary" block size="large" :loading="loading">验证</v-btn>
            <v-btn variant="text" block class="mt-2" :disabled="loading" @click="handleResend">重新发送验证码</v-btn>
            <v-btn variant="text" block @click="step = 'login'">返回登录</v-btn>
          </v-form>

          <!-- 登录/注册 -->
          <v-form v-else @submit.prevent="handleLogin">
            <v-text-field v-model="username" label="用户名" prepend-inner-icon="mdi-account" class="mb-2" />
            <v-text-field v-model="password" label="密码" type="password" prepend-inner-icon="mdi-lock" class="mb-2" />
            <v-text-field v-if="step === 'register' && !isAdmin" v-model="email" label="邮箱" type="email" prepend-inner-icon="mdi-email" class="mb-4" />
            <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>

            <template v-if="isAdmin">
              <v-btn type="submit" color="primary" block size="large" :loading="loading">登录</v-btn>
            </template>
            <template v-else-if="step === 'register'">
              <v-btn type="submit" color="primary" block size="large" :loading="loading" @click.prevent="handleRegister">注册</v-btn>
              <v-btn variant="text" block class="mt-2" @click="step = 'login'">已有账号？登录</v-btn>
            </template>
            <template v-else>
              <v-btn type="submit" color="primary" block size="large" :loading="loading">登录</v-btn>
              <v-btn variant="text" block class="mt-2" @click="step = 'register'">注册账号</v-btn>
            </template>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const username = ref('')
const password = ref('')
const email = ref('')
const verifyCode = ref('')
const registerEmail = ref('')
const error = ref('')
const loading = ref(false)
const step = ref<'login' | 'register' | 'verify'>('login')

const isAdmin = computed(() => username.value.trim() === '一念')

const handleLogin = async () => {
  if (!username.value.trim()) { error.value = '请输入用户名'; return }
  if (!password.value) { error.value = '请输入密码'; return }
  loading.value = true
  error.value = ''
  try {
    await authStore.login(username.value.trim(), password.value)
    router.push({ name: 'daily-board' })
  } catch (e: any) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!username.value.trim() || !password.value || !email.value.trim()) {
    error.value = '请填写所有字段'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await authStore.register(username.value.trim(), password.value, email.value.trim())
    registerEmail.value = email.value.trim()
    step.value = 'verify'
  } catch (e: any) {
    error.value = e.message || '注册失败'
  } finally {
    loading.value = false
  }
}

const handleVerify = async () => {
  if (!verifyCode.value.trim()) { error.value = '请输入验证码'; return }
  loading.value = true
  error.value = ''
  try {
    await authStore.verify(registerEmail.value, verifyCode.value.trim())
    router.push({ name: 'daily-board' })
  } catch (e: any) {
    error.value = e.message || '验证失败'
  } finally {
    loading.value = false
  }
}

const handleResend = async () => {
  loading.value = true
  error.value = ''
  try {
    await authStore.resendCode(registerEmail.value)
    error.value = ''
  } catch (e: any) {
    error.value = e.message || '发送失败'
  } finally {
    loading.value = false
  }
}
</script>
