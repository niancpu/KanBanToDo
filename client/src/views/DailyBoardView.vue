<template>
  <v-container fluid>
    <v-row align="center" class="mb-2">
      <v-col cols="auto" class="d-flex align-center ga-1">
        <v-btn icon="mdi-chevron-left" variant="text" size="small" aria-label="Previous day" @click="prevDay" />
        <h2 class="text-h6 font-weight-medium">{{ displayDate }}</h2>
        <v-btn icon="mdi-chevron-right" variant="text" size="small" aria-label="Next day" @click="nextDay" />
        <v-btn variant="tonal" size="x-small" class="ml-1" @click="goToday">Today</v-btn>
      </v-col>
      <v-spacer />
      <v-col cols="auto">
        <v-btn prepend-icon="mdi-plus" variant="text" size="small" @click="showAddColumn = true">
          Add Column
        </v-btn>
      </v-col>
    </v-row>

    <v-alert
      v-if="isFutureBoard"
      type="info"
      density="compact"
      variant="tonal"
      class="mb-3"
      text="Future board: only ToDo supports creating and moving cards."
    />

    <div class="board-columns d-flex ga-3" style="overflow-x: auto; min-height: calc(100vh - 140px);">
      <div
        v-for="col in boardStore.columns"
        :key="col.id"
        class="board-column"
        style="min-width: 272px; max-width: 320px; flex: 1;"
      >
        <v-card variant="flat" class="h-100 d-flex flex-column board-col-card">
          <div class="board-col-header d-flex align-center justify-space-between px-3 py-2">
            <div class="d-flex align-center ga-2">
              <span class="text-body-2 font-weight-bold">{{ col.title }}</span>
              <span class="text-caption text-medium-emphasis">{{ boardStore.getColumnCards(col.id).length }}</span>
            </div>
            <v-menu v-if="!isProtectedColumn(col)">
              <template #activator="{ props: menuProps }">
                <v-btn icon="mdi-dots-horizontal" size="x-small" variant="text" v-bind="menuProps" />
              </template>
              <v-list density="compact">
                <v-list-item @click="startRenameColumn(col)">
                  <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>
                <v-list-item @click="confirmDeleteColumn(col.id)">
                  <v-list-item-title class="text-error">Delete Column</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>

          <VueDraggable
            v-if="columnCardModels[col.id]"
            v-model="columnCardModels[col.id]!"
            item-key="id"
            group="cards"
            draggable=".card-item"
            :force-fallback="true"
            class="flex-grow-1 px-2 pb-2 board-drop-zone"
            :data-column-id="col.id"
            :animation="200"
            :disabled="isFutureColumnLocked(col)"
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

          <div
            v-if="!columnCardModels[col.id]?.length"
            class="text-caption text-medium-emphasis text-center pa-4"
            style="opacity: 0.5;"
          >
            Drag cards here
          </div>

          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-plus"
            class="mx-2 mb-2"
            :disabled="isFutureColumnLocked(col)"
            @click="showAdd(col.id)"
          >
            Add Card
          </v-btn>
        </v-card>
      </div>
    </div>

    <CardDialog v-model="showAddDialog" :default-effective-date="dateStr" @confirm="confirmAdd" />

    <CardDialog
      v-model="showDetailDialog"
      :card="selectedCard"
      :is-edit="true"
      @confirm="confirmEdit"
      @delete="handleDelete"
    />

    <v-dialog v-model="showAddColumn" max-width="300">
      <v-card>
        <v-card-title>Add Column</v-card-title>
        <v-card-text>
          <v-text-field v-model="newColumnTitle" label="Column Name" autofocus @keyup.enter="confirmAddColumn" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddColumn = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!newColumnTitle.trim()" @click="confirmAddColumn">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showRenameColumn" max-width="300">
      <v-card>
        <v-card-title>Rename Column</v-card-title>
        <v-card-text>
          <v-text-field v-model="renameColumnTitle" label="Column Name" autofocus @keyup.enter="confirmRenameColumn" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRenameColumn = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!renameColumnTitle.trim()" @click="confirmRenameColumn">Confirm</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showConfirmDelete" max-width="300">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>{{ confirmDeleteText }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showConfirmDelete = false">Cancel</v-btn>
          <v-btn color="error" @click="executeDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-overlay
      v-model="cardCtxMenu.show"
      :scrim="false"
      content-class="position-fixed"
      :style="{ top: cardCtxMenu.y + 'px', left: cardCtxMenu.x + 'px' }"
    >
      <v-card elevation="8" rounded="lg" min-width="140">
        <v-list density="compact">
          <v-list-item prepend-icon="mdi-pencil" @click="ctxEditCard">
            <v-list-item-title>Edit</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-delete" class="text-error" @click="ctxDeleteCard">
            <v-list-item-title>Delete</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-overlay>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useBoardStore } from '@/stores/board'
import { DefaultColumnType, toDateStr } from '@kanban/shared'
import type { Priority } from '@kanban/shared'
import type { Card, Column } from '@kanban/shared'
import { useDateNav } from '@/composables/useDateNav'
import { useToast } from '@/composables/useToast'
import CardItem from '@/components/board/CardItem.vue'
import CardDialog from '@/components/board/CardDialog.vue'

const route = useRoute()
const boardStore = useBoardStore()
const toast = useToast()
const { dateStr, displayDate, prevDay, nextDay, goToday, setDate } = useDateNav(
  (route.query.date as string) || undefined,
)
const isFutureBoard = computed(() => dateStr.value > toDateStr(new Date()))
const isFutureColumnLocked = (col: Column) => (
  isFutureBoard.value && col.defaultType !== DefaultColumnType.Todo
)

const columnCardModels = reactive<Record<string, Card[]>>({}) as Record<string, Card[]>
const isDragging = ref(false)
interface DragEndEvent {
  item?: { dataset?: DOMStringMap }
  to?: { dataset?: DOMStringMap }
  newIndex?: number | null
}
const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
)

const syncCardModels = () => {
  if (isDragging.value) return
  for (const col of boardStore.columns) {
    columnCardModels[col.id] = [...boardStore.getColumnCards(col.id)]
  }
}

watch(() => boardStore.cardsByColumn, syncCardModels, { deep: true })
watch(() => boardStore.columns, syncCardModels, { deep: true })

const onDragEnd = async (evt: DragEndEvent) => {
  const targetColId = evt.to?.dataset?.columnId
  const newIndex = typeof evt.newIndex === 'number' ? evt.newIndex : 0
  const cardId = evt.item?.dataset?.id
    || (targetColId ? columnCardModels[targetColId]?.[newIndex]?.id : undefined)
  if (!cardId || !targetColId) {
    isDragging.value = false
    return
  }
  try {
    await boardStore.moveCard(cardId, targetColId, newIndex)
  } catch (e: unknown) {
    toast.error(getErrorMessage(e, 'Move card failed'))
    syncCardModels()
  } finally {
    isDragging.value = false
  }
}

watch(
  () => route.query.date as string | undefined,
  (d) => {
    if (d) setDate(d)
    else goToday()
  },
  { immediate: true },
)
watch(dateStr, (d) => boardStore.loadBoard(d), { immediate: true })

const showAddDialog = ref(false)
const addColumnId = ref('')

const showAdd = (colId: string) => {
  closeCardCtxMenu()
  const col = boardStore.columns.find((c) => c.id === colId)
  if (col && isFutureColumnLocked(col)) {
    toast.error('Future boards only allow adding cards in ToDo')
    return
  }
  addColumnId.value = colId
  showAddDialog.value = true
}

const confirmAdd = async (data: {
  title: string
  description?: string
  priority?: Priority
  effectiveDate?: string
  startDate?: string
  estimatedTime?: number
}) => {
  try {
    await boardStore.addCard({ ...data, columnId: addColumnId.value })
  } catch (e: unknown) {
    toast.error(getErrorMessage(e, 'Create card failed'))
  }
}

const showDetailDialog = ref(false)
const selectedCard = ref<Card | null>(null)

const openCard = (card: Card) => {
  closeCardCtxMenu()
  selectedCard.value = card
  showDetailDialog.value = true
}

const cardCtxMenu = reactive({ show: false, x: 0, y: 0, card: null as Card | null })

const closeCardCtxMenu = () => {
  cardCtxMenu.show = false
  cardCtxMenu.card = null
}

const openCardCtxMenu = (e: MouseEvent, card: Card) => {
  cardCtxMenu.x = e.clientX
  cardCtxMenu.y = e.clientY
  cardCtxMenu.card = card
  cardCtxMenu.show = true
}

const ctxEditCard = () => {
  if (cardCtxMenu.card) openCard(cardCtxMenu.card)
  closeCardCtxMenu()
}

const ctxDeleteCard = () => {
  if (!cardCtxMenu.card) return
  selectedCard.value = cardCtxMenu.card
  closeCardCtxMenu()
  handleDelete()
}

const confirmEdit = async (data: {
  title: string
  description?: string
  priority?: Priority
  effectiveDate?: string
  startDate?: string
  estimatedTime?: number
}) => {
  if (!selectedCard.value) return
  try {
    await boardStore.updateCard(selectedCard.value.id, data)
  } catch (e: unknown) {
    toast.error(getErrorMessage(e, 'Update card failed'))
  }
}

const showConfirmDelete = ref(false)
const confirmDeleteText = ref('')
const pendingDeleteAction = ref<(() => Promise<void>) | null>(null)

const handleDelete = () => {
  if (!selectedCard.value) return
  confirmDeleteText.value = `Delete card "${selectedCard.value.title}"?`
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
  confirmDeleteText.value = `Delete column "${col.title}"?${count > 0 ? ` ${count} cards will also be deleted.` : ''}`
  pendingDeleteAction.value = () => boardStore.deleteColumn(colId)
  showConfirmDelete.value = true
}

const executeDelete = async () => {
  try {
    if (pendingDeleteAction.value) await pendingDeleteAction.value()
  } catch (e: unknown) {
    toast.error(getErrorMessage(e, 'Delete failed'))
  }
  showConfirmDelete.value = false
  pendingDeleteAction.value = null
}

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
.board-col-card {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.board-col-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.board-drop-zone {
  min-height: 60px;
}
.sortable-ghost {
  opacity: 0.3;
}
.sortable-chosen {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
</style>
