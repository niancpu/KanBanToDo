<template>
  <v-container>
    <v-row align="center" class="mb-4">
      <v-col>
        <h2 class="text-h5 font-weight-medium">项目管理</h2>
      </v-col>
      <v-col cols="auto">
        <v-btn prepend-icon="mdi-plus" color="primary" @click="dialog = true">新建项目</v-btn>
      </v-col>
    </v-row>

    <v-row v-if="projectStore.loading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate />
      </v-col>
    </v-row>

    <v-row v-else-if="projectStore.projects.length === 0">
      <v-col cols="12">
        <v-card variant="outlined" class="pa-8 text-center text-medium-emphasis">
          暂无项目，点击右上角新建
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col v-for="project in projectStore.projects" :key="project.id" cols="12" md="4">
        <v-card class="pa-4" variant="outlined">
          <v-card-title>{{ project.title }}</v-card-title>
          <v-card-text class="text-medium-emphasis">{{ project.description || '无描述' }}</v-card-text>
          <v-card-actions>
            <v-btn variant="text" size="small" :to="{ name: 'project-detail', params: { id: project.id } }">
              查看详情
            </v-btn>
            <v-spacer />
            <v-btn icon="mdi-delete" size="small" color="error" variant="text" @click="askDelete(project)" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- 新建项目 -->
    <v-dialog v-model="dialog" max-width="400">
      <v-card>
        <v-card-title>新建项目</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.title" label="项目名称" required autofocus @keyup.enter="handleCreate" />
          <v-textarea v-model="form.description" label="项目描述" rows="3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" :disabled="!form.title.trim()" @click="handleCreate">创建</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认 -->
    <v-dialog v-model="showConfirm" max-width="340">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>确定删除项目「{{ deleteTarget?.title }}」？所有关联的 WBS 节点也会被删除。</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showConfirm = false">取消</v-btn>
          <v-btn color="error" @click="handleDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { Project } from '@kanban/shared'
import { useToast } from '@/composables/useToast'

const projectStore = useProjectStore()
const toast = useToast()
const dialog = ref(false)
const form = reactive({ title: '', description: '' })
const showConfirm = ref(false)
const deleteTarget = ref<Project | null>(null)

onMounted(() => projectStore.loadProjects())

const handleCreate = async () => {
  if (!form.title.trim()) return
  try {
    await projectStore.createProject(form.title.trim(), form.description.trim() || undefined)
    form.title = ''
    form.description = ''
    dialog.value = false
    toast.success('项目创建成功')
  } catch (e: any) {
    toast.error(e.message || '创建失败')
  }
}

const askDelete = (project: Project) => {
  deleteTarget.value = project
  showConfirm.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  try {
    await projectStore.deleteProject(deleteTarget.value.id)
    showConfirm.value = false
    toast.success('项目已删除')
  } catch (e: any) {
    toast.error(e.message || '删除失败')
  }
}
</script>
