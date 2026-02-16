<template>
  <v-dialog :model-value="modelValue" max-width="500" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        {{ isEdit ? '编辑卡片' : '新建卡片' }}
        <v-btn v-if="isEdit" icon="mdi-delete" variant="text" size="small" color="error" @click="$emit('delete')" />
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="form.title" label="标题" autofocus class="mb-2" @keyup.enter="handleConfirm" />
        <v-textarea v-model="form.description" label="描述" rows="2" class="mb-2" />
        <v-select
          v-model="form.priority"
          :items="priorityItems"
          item-title="label"
          item-value="value"
          label="优先级"
          clearable
          class="mb-2"
        />
        <v-text-field v-model="form.startDate" label="开始日期" type="date" class="mb-2" />
        <v-text-field
          v-model.number="form.estimatedTime"
          label="预估时间（分钟）"
          type="number"
          :min="0"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">取消</v-btn>
        <v-btn color="primary" :disabled="!form.title.trim()" @click="handleConfirm">
          {{ isEdit ? '保存' : '创建' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Card } from '@kanban/shared'
import { Priority } from '@kanban/shared'

const props = defineProps<{
  modelValue: boolean
  card?: Card | null
  isEdit?: boolean
  defaultStartDate?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [data: { title: string; description?: string; priority?: Priority; startDate?: string; estimatedTime?: number }]
  delete: []
}>()

const priorityItems = [
  { label: '重要紧急', value: Priority.VH },
  { label: '重要不紧急', value: Priority.VN },
  { label: '不重要紧急', value: Priority.IH },
  { label: '不重要不紧急', value: Priority.IN },
]

const form = reactive({
  title: '',
  description: '',
  priority: undefined as Priority | undefined,
  startDate: '',
  estimatedTime: undefined as number | undefined,
})

watch(() => props.modelValue, (open) => {
  if (open && props.card) {
    form.title = props.card.title
    form.description = props.card.description || ''
    form.priority = props.card.priority
    form.startDate = props.card.startDate || ''
    form.estimatedTime = props.card.estimatedTime
  } else if (open) {
    form.title = ''
    form.description = ''
    form.priority = undefined
    form.startDate = props.defaultStartDate || ''
    form.estimatedTime = undefined
  }
})

const handleConfirm = () => {
  if (!form.title.trim()) return
  emit('confirm', {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    priority: form.priority,
    startDate: form.startDate || undefined,
    estimatedTime: form.estimatedTime || undefined,
  })
  emit('update:modelValue', false)
}
</script>
