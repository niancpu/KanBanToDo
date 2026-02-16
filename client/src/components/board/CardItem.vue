<template>
  <v-card
    class="mb-2 card-item"
    variant="tonal"
    :ripple="false"
    @click="$emit('click', card)"
  >
    <div
      v-if="card.priority"
      class="priority-bar"
      :style="{ backgroundColor: priorityColorMap[card.priority] || 'transparent' }"
    />
    <v-card-text class="pa-3">
      <div class="text-body-2 font-weight-medium">{{ card.title }}</div>
      <div v-if="card.description" class="text-caption text-medium-emphasis mt-1 card-desc">
        {{ card.description }}
      </div>
      <div class="d-flex align-center mt-2 ga-1 flex-wrap">
        <v-chip v-if="card.priority" size="x-small" :color="priorityChipColor[card.priority]">
          {{ card.priority }}
        </v-chip>
        <v-chip v-if="card.estimatedTime" size="x-small" variant="outlined" prepend-icon="mdi-clock-outline">
          {{ formatTime(card.estimatedTime) }}
        </v-chip>
        <v-icon v-if="card.linkedProjectNodeId" size="x-small" icon="mdi-file-tree" title="关联项目" />
        <v-icon v-if="card.linkedHabitId" size="x-small" icon="mdi-repeat" color="success" title="习惯" />
        <v-icon v-if="card.isFromInheritance" size="x-small" icon="mdi-arrow-left-bold" title="继承自前一天" />
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { Card } from '@kanban/shared'
import { Priority } from '@kanban/shared'

defineProps<{ card: Card }>()
defineEmits<{ click: [card: Card] }>()

const priorityColorMap: Record<string, string> = {
  [Priority.VH]: '#E8B4B8',
  [Priority.VN]: '#B4C5E8',
  [Priority.IH]: '#E8CEB4',
  [Priority.IN]: '#B4E8C0',
}

const priorityChipColor: Record<string, string> = {
  [Priority.VH]: 'red',
  [Priority.VN]: 'blue',
  [Priority.IH]: 'orange',
  [Priority.IN]: 'green',
}

const formatTime = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}
</script>

<style scoped>
.card-item { cursor: grab; overflow: hidden; user-select: none; }
.card-item:active { cursor: grabbing; }
.priority-bar { height: 4px; width: 100%; }
.card-desc { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
