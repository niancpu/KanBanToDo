<template>
  <v-container fluid>
    <v-row align="center" class="mb-4">
      <v-col cols="auto">
        <v-btn icon="mdi-arrow-left" variant="text" aria-label="返回项目列表" :to="{ name: 'projects' }" />
      </v-col>
      <v-col>
        <h2 class="text-h5 font-weight-medium">{{ project?.title || '项目详情' }}</h2>
      </v-col>
      <v-col cols="auto">
        <v-btn prepend-icon="mdi-plus" variant="tonal" size="small" @click="addRootNode">添加根节点</v-btn>
        <v-btn
          prepend-icon="mdi-send"
          variant="tonal"
          size="small"
          class="ml-2"
          :disabled="!selectedNode"
          @click="sendToBoard"
        >
          发送到今日看板
        </v-btn>
      </v-col>
    </v-row>

    <v-row>
      <!-- 左侧：WBS 树 -->
      <v-col cols="12" md="5">
        <v-card variant="outlined" class="pa-4" min-height="500">
          <v-card-title class="text-subtitle-1 d-flex align-center justify-space-between">
            WBS 树状结构
            <v-chip size="x-small" variant="tonal">{{ projectStore.wbsNodes.length }} 节点</v-chip>
          </v-card-title>
          <v-card-text v-if="projectStore.wbsNodes.length === 0" class="text-medium-emphasis">
            暂无节点，点击"添加根节点"开始分解
          </v-card-text>
          <v-card-text v-else class="pa-0">
            <div class="wbs-tree">
              <VueDraggable
                v-model="rootNodesModel"
                group="wbs-nodes"
                item-key="id"
                handle=".wbs-node"
                :animation="200"
                @end="onRootDragEnd"
              >
                <WbsTreeNode
                  v-for="node in rootNodesModel"
                  :key="node.id"
                  :node="node"
                  :all-nodes="projectStore.wbsNodes"
                  :selected-id="selectedNode?.id"
                  :hovered-id="hoveredNodeId"
                  @select="selectNode"
                  @add-child="addChildNode"
                  @delete="askDeleteNode"
                  @update="handleUpdateNode"
                  @hover="hoveredNodeId = $event"
                  @reorder="handleReorder"
                />
              </VueDraggable>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 右侧：甘特图 -->
      <v-col cols="12" md="7">
        <v-card variant="outlined" class="pa-4" min-height="500">
          <v-card-title class="text-subtitle-1">甘特图</v-card-title>
          <v-card-text v-if="ganttNodes.length === 0" class="text-medium-emphasis">
            添加带日期的节点后显示甘特图
          </v-card-text>
          <div v-else class="gantt-container" style="overflow-x: auto;">
            <svg :width="ganttWidth" :height="ganttNodes.length * 36 + 40">
              <!-- 时间轴头部 -->
              <g v-for="(col, ci) in ganttDateCols" :key="ci">
                <text
                  :x="ganttLeftPad + ci * ganttColWidth + ganttColWidth / 2"
                  y="14"
                  text-anchor="middle"
                  class="gantt-header-text"
                >
                  {{ col.label }}
                </text>
                <line
                  :x1="ganttLeftPad + ci * ganttColWidth"
                  y1="20"
                  :x2="ganttLeftPad + ci * ganttColWidth"
                  :y2="ganttNodes.length * 36 + 40"
                  stroke="#e0e0e0"
                  stroke-width="0.5"
                />
              </g>
              <!-- 节点条 -->
              <g
                v-for="(gn, gi) in ganttNodes"
                :key="gn.id"
                :class="{ 'gantt-row-highlight': hoveredNodeId === gn.id }"
                @mouseenter="hoveredNodeId = gn.id"
                @mouseleave="hoveredNodeId = null"
              >
                <!-- 行高亮背景 -->
                <rect
                  v-if="hoveredNodeId === gn.id"
                  :x="0"
                  :y="22 + gi * 36"
                  :width="ganttWidth"
                  height="28"
                  fill="rgba(25, 118, 210, 0.06)"
                />
                <!-- 节点标题（按层级缩进） -->
                <text :x="4 + (gn.depth - 1) * 8" :y="30 + gi * 36 + 4" class="gantt-label">
                  {{ gn.title.slice(0, 10) }}
                </text>
                <!-- 背景条 -->
                <rect
                  :x="ganttLeftPad + gn.startOffset * ganttColWidth"
                  :y="24 + gi * 36"
                  :width="Math.max(gn.duration * ganttColWidth, ganttColWidth)"
                  height="24"
                  rx="4"
                  fill="#e0e0e0"
                  class="gantt-bar-bg"
                />
                <!-- 进度条 -->
                <rect
                  :x="ganttLeftPad + gn.startOffset * ganttColWidth"
                  :y="24 + gi * 36"
                  :width="Math.max(gn.duration * ganttColWidth, ganttColWidth) * gn.progress / 100"
                  height="24"
                  rx="4"
                  :fill="statusColor(gn.status)"
                  class="gantt-bar"
                />
                <!-- 进度文字 -->
                <text
                  :x="ganttLeftPad + gn.startOffset * ganttColWidth + 4"
                  :y="24 + gi * 36 + 16"
                  class="gantt-bar-text"
                >
                  {{ gn.progress }}%
                </text>
              </g>
            </svg>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- 编辑节点 -->
    <v-dialog v-model="showEditDialog" max-width="450">
      <v-card>
        <v-card-title>{{ editForm.isNew ? '新建节点' : '编辑节点' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="editForm.title" label="标题" autofocus class="mb-2" @keyup.enter="confirmEdit" />
          <v-textarea v-model="editForm.description" label="描述" rows="2" class="mb-2" />
          <v-select
            v-model="editForm.priority"
            :items="priorityItems"
            item-title="label"
            item-value="value"
            label="优先级"
            clearable
            class="mb-2"
          />
          <v-row>
            <v-col cols="6">
              <v-text-field v-model="editForm.startDate" label="开始日期" type="date" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="editForm.endDate" label="结束日期" type="date" />
            </v-col>
          </v-row>
          <v-text-field v-model.number="editForm.estimatedTime" label="预估时间（分钟）" type="number" :min="0" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEditDialog = false">取消</v-btn>
          <v-btn color="primary" :disabled="!editForm.title.trim()" @click="confirmEdit">
            {{ editForm.isNew ? '创建' : '保存' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认 -->
    <v-dialog v-model="showConfirmDelete" max-width="340">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>确定删除节点「{{ deleteTargetNode?.title }}」及其所有子节点？</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showConfirmDelete = false">取消</v-btn>
          <v-btn color="error" @click="handleDeleteNode">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useProjectStore } from '@/stores/project'
import { useBoardStore } from '@/stores/board'
import type { WbsNode } from '@kanban/shared'
import { Priority, WbsStatus, DefaultColumnType, toDateStr, parseLocalDate } from '@kanban/shared'
import WbsTreeNode from '@/components/wbs/WbsTreeNode.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const projectStore = useProjectStore()
const boardStore = useBoardStore()
const toast = useToast()
const projectId = route.params.id as string

const project = computed(() => projectStore.projects.find((p) => p.id === projectId))
const rootNodes = computed(() =>
  projectStore.wbsNodes
    .filter((n) => !n.parentId && n.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)

// 根节点拖拽排序
const rootNodesModel = ref<WbsNode[]>([])
watch(rootNodes, (newVal) => { rootNodesModel.value = [...newVal] }, { immediate: true })

const onRootDragEnd = async () => {
  const orderedIds = rootNodesModel.value.map((n) => n.id)
  await projectStore.reorderWbsNodes(orderedIds)
}

const handleReorder = async (payload: { parentId: string | undefined; orderedIds: string[] }) => {
  await projectStore.reorderWbsNodes(payload.orderedIds)
}

const selectedNode = ref<WbsNode | null>(null)
const selectNode = (node: WbsNode) => { selectedNode.value = node }

// --- 编辑 ---
const showEditDialog = ref(false)
const editForm = reactive({
  isNew: true,
  parentId: undefined as string | undefined,
  nodeId: '',
  title: '',
  description: '',
  priority: undefined as Priority | undefined,
  startDate: '',
  endDate: '',
  estimatedTime: undefined as number | undefined,
})

const priorityItems = [
  { label: '重要紧急', value: Priority.VH },
  { label: '重要不紧急', value: Priority.VN },
  { label: '不重要紧急', value: Priority.IH },
  { label: '不重要不紧急', value: Priority.IN },
]

const addRootNode = () => {
  const today = toDateStr(new Date())
  Object.assign(editForm, { isNew: true, parentId: undefined, nodeId: '', title: '', description: '', priority: undefined, startDate: today, endDate: '', estimatedTime: undefined })
  showEditDialog.value = true
}

const addChildNode = (parentId: string) => {
  const today = toDateStr(new Date())
  Object.assign(editForm, { isNew: true, parentId, nodeId: '', title: '', description: '', priority: undefined, startDate: today, endDate: '', estimatedTime: undefined })
  showEditDialog.value = true
}

const handleUpdateNode = (node: WbsNode) => {
  Object.assign(editForm, {
    isNew: false, parentId: node.parentId, nodeId: node.id,
    title: node.title, description: node.description || '',
    priority: node.priority, startDate: node.startDate || '',
    endDate: node.endDate || '', estimatedTime: node.estimatedTime,
  })
  showEditDialog.value = true
}

const confirmEdit = async () => {
  if (!editForm.title.trim()) return
  try {
    if (editForm.isNew) {
      await projectStore.addWbsNode({ projectId, parentId: editForm.parentId, title: editForm.title.trim() })
      const nodes = projectStore.wbsNodes
      const newNode = nodes[nodes.length - 1]
      if (newNode && (editForm.description || editForm.priority || editForm.startDate || editForm.endDate || editForm.estimatedTime)) {
        await projectStore.updateWbsNode(newNode.id, {
          description: editForm.description || undefined,
          priority: editForm.priority,
          startDate: editForm.startDate || undefined,
          endDate: editForm.endDate || undefined,
          estimatedTime: editForm.estimatedTime,
        })
      }
      toast.success('节点创建成功')
    } else {
      await projectStore.updateWbsNode(editForm.nodeId, {
        title: editForm.title.trim(),
        description: editForm.description || undefined,
        priority: editForm.priority,
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
        estimatedTime: editForm.estimatedTime,
      })
      toast.success('节点已更新')
    }
    showEditDialog.value = false
  } catch (e: any) {
    toast.error(e.message || '操作失败')
  }
}

// --- 删除 ---
const showConfirmDelete = ref(false)
const deleteTargetNode = ref<WbsNode | null>(null)

const askDeleteNode = (nodeId: string) => {
  deleteTargetNode.value = projectStore.wbsNodes.find((n) => n.id === nodeId) || null
  showConfirmDelete.value = true
}

const handleDeleteNode = async () => {
  if (!deleteTargetNode.value) return
  try {
    await projectStore.deleteWbsNode(deleteTargetNode.value.id)
    if (selectedNode.value?.id === deleteTargetNode.value.id) selectedNode.value = null
    showConfirmDelete.value = false
    toast.success('节点已删除')
  } catch (e: any) {
    toast.error(e.message || '删除失败')
  }
}

// --- 发送到今日看板 ---
const sendToBoard = async () => {
  if (!selectedNode.value) return
  try {
    const dateStr = toDateStr(new Date())
    await boardStore.loadBoard(dateStr)
    const todoCol = boardStore.columns.find((c) => c.defaultType === DefaultColumnType.Todo)
    if (!todoCol) return
    await boardStore.addCard({
      title: selectedNode.value.title,
      columnId: todoCol.id,
      description: selectedNode.value.description,
      priority: selectedNode.value.priority,
      estimatedTime: selectedNode.value.estimatedTime,
      linkedProjectNodeId: selectedNode.value.id,
    })
    toast.success('已发送到今日看板')
  } catch (e: any) {
    toast.error(e.message || '发送失败')
  }
}

// --- 甘特图 ---
const ganttLeftPad = 100
const ganttColWidth = 32

// 高亮联动状态
const hoveredNodeId = ref<string | null>(null)

/** 按 WBS 树的 DFS 先序遍历排列，保证甘特图行顺序和左侧树一致 */
const dfsOrderNodes = computed(() => {
  const result: WbsNode[] = []
  const visit = (parentId?: string) => {
    projectStore.wbsNodes
      .filter((n) => n.parentId === parentId && n.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((n) => { result.push(n); visit(n.id) })
  }
  visit(undefined)
  return result
})

const ganttNodes = computed(() => {
  const ordered = dfsOrderNodes.value.filter((n) => n.startDate && n.endDate)
  if (ordered.length === 0) return []
  return ordered.map((n) => ({
    id: n.id,
    title: n.title,
    progress: n.progress,
    status: n.status,
    depth: n.depth,
    startOffset: daysBetween(ganttMinDate.value, n.startDate!),
    duration: Math.max(daysBetween(n.startDate!, n.endDate!) + 1, 1),
  }))
})

const ganttMinDate = computed(() => {
  const dates = projectStore.wbsNodes.filter((n) => n.startDate).map((n) => n.startDate!)
  return dates.length > 0 ? dates.sort()[0]! : new Date().toISOString().slice(0, 10)
})

const ganttMaxDate = computed(() => {
  const dates = projectStore.wbsNodes.filter((n) => n.endDate).map((n) => n.endDate!)
  return dates.length > 0 ? dates.sort().reverse()[0]! : new Date().toISOString().slice(0, 10)
})

const ganttDateCols = computed(() => {
  const cols: { label: string }[] = []
  const start = parseLocalDate(ganttMinDate.value)
  const end = parseLocalDate(ganttMaxDate.value)
  const d = new Date(start)
  while (d <= end) {
    cols.push({ label: `${d.getMonth() + 1}/${d.getDate()}` })
    d.setDate(d.getDate() + 1)
  }
  if (cols.length === 0) cols.push({ label: '' })
  return cols
})

const ganttWidth = computed(() => ganttLeftPad + ganttDateCols.value.length * ganttColWidth + 20)

const daysBetween = (a: string, b: string) => {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000)
}

const statusColor = (status: WbsStatus) => {
  const map: Record<string, string> = {
    [WbsStatus.Done]: '#4CAF50',
    [WbsStatus.InProgress]: '#2196F3',
    [WbsStatus.NotStarted]: '#9E9E9E',
    [WbsStatus.Dropped]: '#FF5252',
  }
  return map[status] || '#9E9E9E'
}

onMounted(async () => {
  await projectStore.loadProjects()
  await projectStore.loadWbsNodes(projectId)
})
</script>

<style scoped>
.wbs-tree { padding: 8px 0; }
.gantt-container { padding: 8px 0; }
.gantt-header-text { font-size: 10px; fill: #666; }
.gantt-label { font-size: 11px; fill: #333; }
.gantt-bar-text { font-size: 10px; fill: white; font-weight: 500; }
.gantt-bar-bg { cursor: pointer; }
.gantt-bar { cursor: ew-resize; }
</style>
