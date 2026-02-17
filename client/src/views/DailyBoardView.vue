<template>
  <v-container fluid>
    <v-row align="center" class="mb-4">
      <v-col cols="auto">
        <v-btn icon="mdi-chevron-left" variant="text" aria-label="前一天" @click="prevDay" />
      </v-col>
      <v-col cols="auto">
        <h2 class="text-h5 font-weight-medium">{{ displayDate }}</h2>
      </v-col>
      <v-col cols="auto">
        <v-btn icon="mdi-chevron-right" variant="text" aria-label="后一天" @click="nextDay" />
      </v-col>
      <v-col cols="auto">
        <v-btn variant="tonal" size="small" @click="goToday">今天</v-btn>
      </v-col>
      <v-spacer />
      <v-col cols="auto">
        <v-btn prepend-icon="mdi-plus" variant="tonal" size="small" @click="showAddColumn = true">
          添加列
        </v-btn>
      </v-col>
    </v-row>

    <div class="board-columns d-flex ga-4" style="overflow-x: auto; min-height: 70vh;">
      <div
        v-for="col in boardStore.columns"
        :key="col.id"
        class="board-column"
        style="min-width: 280px; max-width: 320px; flex: 1;"
      >
        <v-card variant="outlined" class="pa-2 h-100 d-flex flex-column">
          <v-card-title class="text-subtitle-1 font-weight-medium d-flex align-center justify-space-between">
            <span>{{ col.title }}</span>
            <div class="d-flex align-center ga-1">
              <v-chip size="x-small" variant="tonal">{{ boardStore.getColumnCards(col.id).length }}</v-chip>
              <v-menu v-if="!isProtectedColumn(col)">
                <template #activator="{ props: menuProps }">
                  <v-btn icon="mdi-dots-vertical" size="x-small" variant="text" v-bind="menuProps" />
                </template>
                <v-list density="compact">
                  <v-list-item @click="startRenameColumn(col)">
                    <v-list-item-title>重命名</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="confirmDeleteColumn(col.id)">
                    <v-list-item-title class="text-error">删除列</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </v-card-title>

          <VueDraggable
            v-if="columnCardModels[col.id]"
            v-model="columnCardModels[col.id]!"
            item-key="id"
            group="cards"
            draggable=".card-item"
            :force-fallback="true"
            class="flex-grow-1 pa-1"
            style="min-height: 100px;"
            :data-column-id="col.id"
            :animation="200"
            @start="isDragging = true"
            @end="onDragEnd"
          >
            <CardItem
              v-for="card in columnCardModels[col.id]"
              :key="card.id"
              :card="card"
              :data-id="card.id"
              @click="openCard(card)"
              @contextmenu.prevent="openCardCtxMenu($event, card)"
            />
          </VueDraggable>

          <v-btn variant="text" size="small" prepend-icon="mdi-plus" class="mt-1" @click="showAdd(col.id)">
            添加卡片
          </v-btn>
        </v-card>
      </div>
    </div>

    <!-- 发送到 WBS 的浮动按钮区域 -->
    <div v-if="isDragging" class="wbs-drop-zone">
      <v-icon icon="mdi-file-tree" size="large" />
      <span class="text-caption">发送到 WBS</span>
    </div>

    <!-- 新建卡片 -->
    <CardDialog v-model="showAddDialog" :default-start-date="dateStr" @confirm="confirmAdd" />

    <!-- 编辑卡片 -->
    <CardDialog
      v-model="showDetailDialog"
      :card="selectedCard"
      :is-edit="true"
      @confirm="confirmEdit"
      @delete="handleDelete"
    />

    <!-- 添加列 -->
    <v-dialog v-model="showAddColumn" max-width="300">
      <v-card>
        <v-card-title>添加列</v-card-title>
        <v-card-text>
          <v-text-field v-model="newColumnTitle" label="列名称" autofocus @keyup.enter="confirmAddColumn" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddColumn = false">取消</v-btn>
          <v-btn color="primary" :disabled="!newColumnTitle.trim()" @click="confirmAddColumn">添加</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 重命名列 -->
    <v-dialog v-model="showRenameColumn" max-width="300">
      <v-card>
        <v-card-title>重命名列</v-card-title>
        <v-card-text>
          <v-text-field v-model="renameColumnTitle" label="列名称" autofocus @keyup.enter="confirmRenameColumn" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRenameColumn = false">取消</v-btn>
          <v-btn color="primary" :disabled="!renameColumnTitle.trim()" @click="confirmRenameColumn">确认</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认 -->
    <v-dialog v-model="showConfirmDelete" max-width="300">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>{{ confirmDeleteText }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showConfirmDelete = false">取消</v-btn>
          <v-btn color="error" @click="executeDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 卡片右键菜单 -->
    <v-menu v-model="cardCtxMenu.show" :style="{ position: 'fixed', left: cardCtxMenu.x + 'px', top: cardCtxMenu.y + 'px' }">
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-pencil" @click="ctxEditCard">
          <v-list-item-title>编辑</v-list-item-title>
        </v-list-item>
        <v-list-item prepend-icon="mdi-delete" class="text-error" @click="ctxDeleteCard">
          <v-list-item-title>删除</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useBoardStore } from '@/stores/board'
import type { Priority } from '@kanban/shared'
import type { Card, Column } from '@kanban/shared'
import { useDateNav } from '@/composables/useDateNav'
import CardItem from '@/components/board/CardItem.vue'
import CardDialog from '@/components/board/CardDialog.vue'

const route = useRoute()
const boardStore = useBoardStore()
const { dateStr, displayDate, prevDay, nextDay, goToday, setDate } = useDateNav(
  (route.query.date as string) || undefined,
)

// 为 vue-draggable-plus 提供可变数组
const columnCardModels = reactive<Record<string, Card[]>>({}) as Record<string, Card[]>
const isDragging = ref(false)

const syncCardModels = () => {
  if (isDragging.value) return
  for (const col of boardStore.columns) {
    columnCardModels[col.id] = [...boardStore.getColumnCards(col.id)]
  }
}

watch(() => boardStore.cardsByColumn, syncCardModels, { deep: true })
watch(() => boardStore.columns, syncCardModels, { deep: true })

const onDragEnd = async (evt: any) => {
  isDragging.value = false
  const cardId = evt.item?.dataset?.id || columnCardModels[evt.to?.dataset?.columnId]?.[evt.newIndex]?.id
  const targetColId = evt.to?.dataset?.columnId
  if (!cardId || !targetColId) return
  await boardStore.moveCard(cardId, targetColId, evt.newIndex ?? 0)
}

// 日期切换 — 用 immediate 保证组件复用时也能同步 query 参数
watch(
  () => route.query.date as string | undefined,
  (d) => {
    if (d) setDate(d)
    else goToday()
  },
  { immediate: true },
)
watch(dateStr, (d) => boardStore.loadBoard(d), { immediate: true })

// 新建卡片
const showAddDialog = ref(false)
const addColumnId = ref('')

const showAdd = (colId: string) => {
  addColumnId.value = colId
  showAddDialog.value = true
}

const confirmAdd = async (data: { title: string; description?: string; priority?: Priority; startDate?: string; estimatedTime?: number }) => {
  await boardStore.addCard({ ...data, columnId: addColumnId.value })
}

// 编辑卡片
const showDetailDialog = ref(false)
const selectedCard = ref<Card | null>(null)

const openCard = (card: Card) => {
  selectedCard.value = card
  showDetailDialog.value = true
}

// 卡片右键菜单
const cardCtxMenu = reactive({ show: false, x: 0, y: 0, card: null as Card | null })

const openCardCtxMenu = (e: MouseEvent, card: Card) => {
  cardCtxMenu.x = e.clientX
  cardCtxMenu.y = e.clientY
  cardCtxMenu.card = card
  cardCtxMenu.show = true
}

const ctxEditCard = () => {
  if (cardCtxMenu.card) openCard(cardCtxMenu.card)
}

const ctxDeleteCard = () => {
  if (!cardCtxMenu.card) return
  selectedCard.value = cardCtxMenu.card
  handleDelete()
}

const confirmEdit = async (data: { title: string; description?: string; priority?: Priority; startDate?: string; estimatedTime?: number }) => {
  if (!selectedCard.value) return
  await boardStore.updateCard(selectedCard.value.id, data)
}

// 删除
const showConfirmDelete = ref(false)
const confirmDeleteText = ref('')
const pendingDeleteAction = ref<(() => Promise<void>) | null>(null)

const handleDelete = () => {
  if (!selectedCard.value) return
  confirmDeleteText.value = `确定删除卡片「${selectedCard.value.title}」？`
  pendingDeleteAction.value = async () => {
    await boardStore.deleteCard(selectedCard.value!.id)
    showDetailDialog.value = false
  }
  showConfirmDelete.value = true
}

const confirmDeleteColumn = (colId: string) => {
  const col = boardStore.columns.find((c) => c.id === colId)
  if (!col) return
  const count = boardStore.getColumnCards(colId).length
  confirmDeleteText.value = `确定删除列「${col.title}」？${count > 0 ? `其中 ${count} 张卡片也会被删除。` : ''}`
  pendingDeleteAction.value = () => boardStore.deleteColumn(colId)
  showConfirmDelete.value = true
}

const executeDelete = async () => {
  if (pendingDeleteAction.value) await pendingDeleteAction.value()
  showConfirmDelete.value = false
  pendingDeleteAction.value = null
}

// 自定义列
const showAddColumn = ref(false)
const newColumnTitle = ref('')
const showRenameColumn = ref(false)
const renameColumnTitle = ref('')
const renameColumnId = ref('')

const isProtectedColumn = (col: Column) => !!col.defaultType

const confirmAddColumn = async () => {
  if (!newColumnTitle.value.trim()) return
  await boardStore.addColumn(newColumnTitle.value.trim())
  newColumnTitle.value = ''
  showAddColumn.value = false
}

const startRenameColumn = (col: Column) => {
  renameColumnId.value = col.id
  renameColumnTitle.value = col.title
  showRenameColumn.value = true
}

const confirmRenameColumn = async () => {
  if (!renameColumnTitle.value.trim()) return
  await boardStore.renameColumn(renameColumnId.value, renameColumnTitle.value.trim())
  showRenameColumn.value = false
}
</script>

<style scoped>
.sortable-ghost { opacity: 0.4; }
.wbs-drop-zone {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 80px;
  height: 80px;
  border: 2px dashed rgba(var(--v-theme-primary), 0.5);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.08);
  z-index: 100;
}
</style>
