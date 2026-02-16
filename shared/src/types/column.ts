import type { DefaultColumnType } from '../enums'

export interface Column {
  id: string
  boardId: string
  title: string
  sortOrder: number
  defaultType?: DefaultColumnType // 系统默认列标识，自定义列无此字段
}
