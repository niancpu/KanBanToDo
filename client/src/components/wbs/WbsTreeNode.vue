<template>
  <div
    class="wbs-node"
    :style="{ paddingLeft: indent + 'px' }"
    :class="{
      'wbs-node-selected': node.id === selectedId,
      'wbs-node-hovered': node.id === hoveredId,
    }"
    @click.stop="$emit('select', node)"
    @mouseenter="$emit('hover', node.id)"
    @mouseleave="$emit('hover', null)"
  >
    <div class="d-flex align-center ga-1 py-1">
      <v-icon
        v-if="hasChildren"
        :icon="expanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
        size="small"
        @click.stop="expanded = !expanded"
      />
      <v-icon v-else icon="mdi-circle-small" size="small" />

      <div
        v-if="node.priority"
        class="priority-dot"
        :style="{ backgroundColor: priorityColor[node.priority] || 'transparent' }"
      />

      <span class="text-body-2 flex-grow-1">{{ node.title }}</span>

      <v-chip size="x-small" :color="statusChipColor" variant="tonal">
        {{ statusLabel }}
      </v-chip>

      <span class="text-caption text-medium-emphasis" style="min-width: 36px; text-align: right;">
        {{ node.progress }}%
      </span>

      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn icon="mdi-dots-horizontal" size="x-small" variant="text" v-bind="menuProps" @click.stop />
        </template>
        <v-list density="compact">
          <v-list-item @click="$emit('update', node)">
            <v-list-item-title>编辑</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="node.depth < 4" @click="$emit('addChild', node.id)">
            <v-list-item-title>添加子节点</v-list-item-title>
          </v-list-item>
          <v-list-item @click="$emit('delete', node.id)">
            <v-list-item-title class="text-error">删除</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar-container" :style="{ marginLeft: indent + 24 + 'px' }">
      <div class="progress-bar" :style="{ width: node.progress + '%', backgroundColor: statusBarColor }" />
    </div>

    <!-- 子节点（可拖拽排序） -->
    <VueDraggable
      v-if="expanded && hasChildren"
      v-model="childrenModel"
      group="wbs-nodes"
      item-key="id"
      handle=".wbs-node"
      :animation="200"
      @end="onDragEnd"
    >
      <WbsTreeNode
        v-for="child in childrenModel"
        :key="child.id"
        :node="child"
        :all-nodes="allNodes"
        :selected-id="selectedId"
        :hovered-id="hoveredId"
        :depth="depth + 1"
        @select="$emit('select', $event)"
        @add-child="$emit('addChild', $event)"
        @delete="$emit('delete', $event)"
        @update="$emit('update', $event)"
        @hover="$emit('hover', $event)"
        @reorder="$emit('reorder', $event)"
      />
    </VueDraggable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { WbsNode } from '@kanban/shared'
import { Priority, WbsStatus } from '@kanban/shared'

const props = withDefaults(defineProps<{
  node: WbsNode
  allNodes: WbsNode[]
  selectedId?: string
  hoveredId?: string | null
  depth?: number
}>(), { depth: 0 })

const emit = defineEmits<{
  select: [node: WbsNode]
  addChild: [parentId: string]
  delete: [nodeId: string]
  update: [node: WbsNode]
  hover: [nodeId: string | null]
  reorder: [payload: { parentId: string | undefined; orderedIds: string[] }]
}>()

const expanded = ref(true)
const indent = computed(() => props.depth * 20)

const children = computed(() =>
  props.allNodes
    .filter((n) => n.parentId === props.node.id)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)

const hasChildren = computed(() => children.value.length > 0)

// 可变数组供拖拽使用，从 computed 同步
const childrenModel = ref<WbsNode[]>([])
watch(children, (newVal) => { childrenModel.value = [...newVal] }, { immediate: true })

const onDragEnd = () => {
  const orderedIds = childrenModel.value.map((c) => c.id)
  emit('reorder', { parentId: props.node.id, orderedIds })
}

const priorityColor: Record<string, string> = {
  [Priority.VH]: '#E8B4B8',
  [Priority.VN]: '#B4C5E8',
  [Priority.IH]: '#E8CEB4',
  [Priority.IN]: '#B4E8C0',
}

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    [WbsStatus.NotStarted]: 'Not Started',
    [WbsStatus.InProgress]: 'Doing',
    [WbsStatus.Done]: 'Done',
    [WbsStatus.Dropped]: 'Dropped',
  }
  return map[props.node.status] || props.node.status
})

const statusChipColor = computed(() => {
  const map: Record<string, string> = {
    [WbsStatus.NotStarted]: 'grey',
    [WbsStatus.InProgress]: 'blue',
    [WbsStatus.Done]: 'success',
    [WbsStatus.Dropped]: 'error',
  }
  return map[props.node.status] || 'grey'
})

const statusBarColor = computed(() => {
  const map: Record<string, string> = {
    [WbsStatus.NotStarted]: '#9E9E9E',
    [WbsStatus.InProgress]: '#2196F3',
    [WbsStatus.Done]: '#4CAF50',
    [WbsStatus.Dropped]: '#FF5252',
  }
  return map[props.node.status] || '#9E9E9E'
})
</script>

<style scoped>
.wbs-node { cursor: pointer; border-radius: 4px; transition: background 0.15s; }
.wbs-node:hover { background: rgba(0, 0, 0, 0.04); }
.wbs-node-selected { background: rgba(25, 118, 210, 0.08); }
.wbs-node-hovered { background: rgba(25, 118, 210, 0.12) !important; outline: 1px solid rgba(25, 118, 210, 0.3); }
.sortable-ghost { opacity: 0.4; }
.priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.progress-bar-container { height: 3px; background: #eee; border-radius: 2px; margin-bottom: 2px; margin-right: 8px; }
.progress-bar { height: 100%; border-radius: 2px; transition: width 0.3s; }
</style>
