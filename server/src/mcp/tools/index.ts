import { BoardService } from '../../board/board.service'
import { HabitService } from '../../habit/habit.service'
import type { ToolDefinition } from '../types'
import { buildBoardTools } from './boardTools'
import { buildHabitTools } from './habitTools'

export function buildTools(userId: string, boardService: BoardService, habitService: HabitService): ToolDefinition[] {
  return [
    ...buildBoardTools(userId, boardService),
    ...buildHabitTools(userId, habitService),
  ]
}