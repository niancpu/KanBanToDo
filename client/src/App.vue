<template>
  <v-app>
    <template v-if="authStore.isAuthenticated">
      <v-navigation-drawer v-model="drawer" app width="220">
        <div class="pa-4 pb-2">
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-view-dashboard" color="primary" size="28" />
            <span class="text-subtitle-1 font-weight-bold">KanBan ToDo</span>
          </div>
        </div>

        <v-divider class="mb-2" />

        <v-list nav density="compact" class="px-2">
          <v-list-item
            prepend-icon="mdi-view-column"
            title="每日看板"
            :to="{ name: 'daily-board' }"
            rounded="lg"
            class="mb-1"
          />
          <v-list-item
            prepend-icon="mdi-checkbox-marked-circle-outline"
            title="习惯追踪"
            :to="{ name: 'habits' }"
            rounded="lg"
            class="mb-1"
          />
          <v-list-item
            prepend-icon="mdi-calendar"
            title="日历"
            :to="{ name: 'calendar' }"
            rounded="lg"
          />
        </v-list>

        <template #append>
          <v-divider />
          <div class="pa-3">
            <div class="d-flex align-center ga-2">
              <v-avatar size="32" color="primary" variant="tonal">
                <span class="text-caption font-weight-bold">{{ avatarText }}</span>
              </v-avatar>
              <div class="flex-grow-1" style="min-width: 0;">
                <div class="text-body-2 font-weight-medium text-truncate">{{ authStore.user?.username || '用户' }}</div>
              </div>
              <v-btn icon="mdi-logout" size="x-small" variant="text" @click="handleLogout" />
            </div>
          </div>
        </template>
      </v-navigation-drawer>

      <v-app-bar app flat color="surface" border="b" density="compact">
        <v-app-bar-nav-icon aria-label="切换侧边栏" @click="drawer = !drawer" />
        <v-app-bar-title class="text-body-1 font-weight-medium text-medium-emphasis">
          {{ pageTitle }}
        </v-app-bar-title>
      </v-app-bar>
    </template>

    <v-main>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </v-main>

    <!-- Global toast -->
    <v-snackbar v-model="toast.visible.value" :color="toast.type.value" :timeout="toast.timeout.value" location="top">
      {{ toast.message.value }}
      <template #actions>
        <v-btn variant="text" @click="toast.visible.value = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const drawer = ref(true)
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const avatarText = computed(() => {
  const name = authStore.user?.username || '?'
  return name.slice(0, 1).toUpperCase()
})

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    'daily-board': '每日看板',
    'habits': '习惯追踪',
    'calendar': '日历',
  }
  return map[route.name as string] || ''
})

const handleLogout = () => {
  authStore.logout()
  router.push({ name: 'login' })
}
</script>


<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
