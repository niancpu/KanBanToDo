<template>
  <v-app>
    <template v-if="authStore.isAuthenticated">
      <v-navigation-drawer v-model="drawer" app>
        <v-list nav density="compact">
          <v-list-item
            prepend-icon="mdi-view-column"
            title="每日看板"
            :to="{ name: 'daily-board' }"
          />
          <v-list-item
            prepend-icon="mdi-file-tree"
            title="项目管理"
            :to="{ name: 'projects' }"
          />
          <v-list-item
            prepend-icon="mdi-checkbox-marked-circle-outline"
            title="习惯追踪"
            :to="{ name: 'habits' }"
          />
          <v-list-item
            prepend-icon="mdi-calendar"
            title="日历"
            :to="{ name: 'calendar' }"
          />
        </v-list>
      </v-navigation-drawer>

      <v-app-bar app flat color="surface" border="b">
        <v-app-bar-nav-icon @click="drawer = !drawer" />
        <v-app-bar-title class="font-weight-medium">KanBan ToDo</v-app-bar-title>
        <v-spacer />
        <v-menu>
          <template #activator="{ props }">
            <v-btn icon="mdi-account-circle" v-bind="props" />
          </template>
          <v-card min-width="200">
            <v-card-text class="text-center pb-2">
              <v-icon size="48" color="primary" class="mb-2">mdi-account-circle</v-icon>
              <div class="text-subtitle-1 font-weight-medium">{{ authStore.user?.username || '用户' }}</div>
            </v-card-text>
            <v-divider />
            <v-list density="compact">
              <v-list-item prepend-icon="mdi-logout" title="退出登录" @click="handleLogout" />
            </v-list>
          </v-card>
        </v-menu>
      </v-app-bar>
    </template>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const drawer = ref(true)
const router = useRouter()
const authStore = useAuthStore()

const handleLogout = () => {
  authStore.logout()
  router.push({ name: 'login' })
}
</script>
