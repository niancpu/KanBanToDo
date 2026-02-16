import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Project, WbsNode } from '@kanban/shared'
import { WbsStatus } from '@kanban/shared'
import { getDB } from '@/db'

const MAX_DEPTH = 4

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const wbsNodes = ref<WbsNode[]>([])
  const loading = ref(false)

  const loadProjects = async () => {
    loading.value = true
    try {
      const db = await getDB()
      projects.value = await db.getAll('projects')
    } finally {
      loading.value = false
    }
  }

  const createProject = async (title: string, description?: string) => {
    const project: Project = {
      id: uuidv4(),
      title,
      description,
      userId: '',
      createdAt: new Date().toISOString(),
    }
    const db = await getDB()
    await db.put('projects', project)
    projects.value.push(project)
    return project
  }

  const deleteProject = async (id: string) => {
    const db = await getDB()
    const allNodes = await db.getAllFromIndex('wbsNodes', 'by-project', id)
    const tx = db.transaction(['projects', 'wbsNodes'], 'readwrite')
    for (const n of allNodes) tx.objectStore('wbsNodes').delete(n.id)
    tx.objectStore('projects').delete(id)
    await tx.done
    projects.value = projects.value.filter((p) => p.id !== id)
    wbsNodes.value = wbsNodes.value.filter((n) => n.projectId !== id)
  }

  // --- WBS ---

  const loadWbsNodes = async (projectId: string) => {
    const db = await getDB()
    wbsNodes.value = await db.getAllFromIndex('wbsNodes', 'by-project', projectId)
  }

  const getChildren = (parentId?: string) =>
    wbsNodes.value
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const addWbsNode = async (data: {
    projectId: string
    parentId?: string
    title: string
  }) => {
    // 检查层数限制
    const parentDepth = data.parentId
      ? (wbsNodes.value.find((n) => n.id === data.parentId)?.depth ?? 0)
      : 0
    if (parentDepth >= MAX_DEPTH) return null

    const siblings = wbsNodes.value.filter((n) => n.parentId === data.parentId && n.projectId === data.projectId)
    const node: WbsNode = {
      id: uuidv4(),
      projectId: data.projectId,
      parentId: data.parentId,
      title: data.title,
      sortOrder: siblings.length,
      progress: 0,
      status: WbsStatus.NotStarted,
      depth: parentDepth + 1,
    }
    const db = await getDB()
    await db.put('wbsNodes', node)
    wbsNodes.value.push(node)
    return node
  }

  const updateWbsNode = async (nodeId: string, data: Partial<WbsNode>) => {
    const node = wbsNodes.value.find((n) => n.id === nodeId)
    if (!node) return
    Object.assign(node, data)
    const db = await getDB()
    await db.put('wbsNodes', { ...node })
    // 更新父节点进度
    if (node.parentId) await recalcProgress(node.parentId)
  }

  const deleteWbsNode = async (nodeId: string) => {
    // 递归收集所有子孙节点
    const toDelete = new Set<string>()
    const collect = (id: string) => {
      toDelete.add(id)
      wbsNodes.value.filter((n) => n.parentId === id).forEach((n) => collect(n.id))
    }
    collect(nodeId)

    const db = await getDB()
    const tx = db.transaction('wbsNodes', 'readwrite')
    for (const id of toDelete) tx.store.delete(id)
    await tx.done

    const parentId = wbsNodes.value.find((n) => n.id === nodeId)?.parentId
    wbsNodes.value = wbsNodes.value.filter((n) => !toDelete.has(n.id))
    if (parentId) await recalcProgress(parentId)
  }

  /** 重新计算分组节点的进度 */
  const recalcProgress = async (nodeId: string) => {
    const node = wbsNodes.value.find((n) => n.id === nodeId)
    if (!node) return

    const children = wbsNodes.value.filter((n) => n.parentId === nodeId)
    if (children.length === 0) return // 叶子节点不自动计算

    const allHaveTime = children.every((c) => c.estimatedTime != null && c.estimatedTime > 0)

    let progress: number
    if (allHaveTime) {
      // 按预估时间加权
      const totalTime = children.reduce((s, c) => s + (c.estimatedTime ?? 0), 0)
      progress = totalTime > 0
        ? Math.round(children.reduce((s, c) => s + c.progress * (c.estimatedTime ?? 0), 0) / totalTime)
        : 0
    } else {
      // 按数量平均
      progress = Math.round(children.reduce((s, c) => s + c.progress, 0) / children.length)
    }

    // 推导状态
    let status: WbsStatus
    if (children.every((c) => c.status === WbsStatus.Done)) {
      status = WbsStatus.Done
    } else if (children.every((c) => c.status === WbsStatus.NotStarted)) {
      status = WbsStatus.NotStarted
    } else {
      status = WbsStatus.InProgress
    }

    node.progress = progress
    node.status = status
    const db = await getDB()
    await db.put('wbsNodes', { ...node })

    // 递归向上
    if (node.parentId) await recalcProgress(node.parentId)
  }

  /** 更新叶子节点状态（由每日看板卡片同步调用） */
  const syncNodeStatus = async (nodeId: string, status: WbsStatus) => {
    const node = wbsNodes.value.find((n) => n.id === nodeId)
    if (!node) return
    node.status = status
    node.progress = status === WbsStatus.Done ? 100 : status === WbsStatus.InProgress ? 50 : 0
    const db = await getDB()
    await db.put('wbsNodes', { ...node })
    if (node.parentId) await recalcProgress(node.parentId)
  }

  /** 批量更新同级节点的 sortOrder（拖拽排序用） */
  const reorderWbsNodes = async (orderedIds: string[]) => {
    const db = await getDB()
    const tx = db.transaction('wbsNodes', 'readwrite')
    for (let i = 0; i < orderedIds.length; i++) {
      const node = wbsNodes.value.find((n) => n.id === orderedIds[i])
      if (node) {
        node.sortOrder = i
        tx.store.put({ ...node })
      }
    }
    await tx.done
  }

  return {
    projects, wbsNodes, loading,
    loadProjects, createProject, deleteProject,
    loadWbsNodes, getChildren, addWbsNode, updateWbsNode, deleteWbsNode,
    recalcProgress, syncNodeStatus, reorderWbsNodes,
  }
})
