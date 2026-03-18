import { BoardService } from '../../board/board.service'
import type { ToolDefinition } from '../types'
import {
  asOptionalNumber,
  asOptionalString,
  asString,
  asStringArray,
  ensureWriteAllowed,
  todayDate,
} from '../utils'

export function buildBoardTools(userId: string, boardService: BoardService): ToolDefinition[] {
  return [
    {
      name: 'board_get',
      description: 'Get or create a board for a specific date',
      inputSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD; defaults to today when omitted' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        const date = asOptionalString(args.date, 'date') ?? todayDate()
        return boardService.getOrCreateBoard(userId, date)
      },
    },
    {
      name: 'board_add_card',
      description: 'Add a card into a board column',
      inputSchema: {
        type: 'object',
        required: ['boardId', 'columnId', 'title'],
        properties: {
          boardId: { type: 'string' },
          columnId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', description: 'UI, INU, UNI, or NN' },
          sortOrder: { type: 'number', description: 'Defaults to 0' },
          startDate: { type: 'string', description: 'YYYY-MM-DD' },
          estimatedTime: { type: 'number', description: 'minutes' },
          linkedHabitId: { type: 'string' },
          isFromInheritance: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return boardService.addCard(userId, {
          boardId: asString(args.boardId, 'boardId'),
          columnId: asString(args.columnId, 'columnId'),
          title: asString(args.title, 'title'),
          description: asOptionalString(args.description, 'description'),
          priority: asOptionalString(args.priority, 'priority'),
          sortOrder: asOptionalNumber(args.sortOrder, 'sortOrder') ?? 0,
          startDate: asOptionalString(args.startDate, 'startDate'),
          estimatedTime: asOptionalNumber(args.estimatedTime, 'estimatedTime'),
          linkedHabitId: asOptionalString(args.linkedHabitId, 'linkedHabitId'),
          isFromInheritance: Boolean(args.isFromInheritance),
        })
      },
    },
    {
      name: 'board_update_card',
      description: 'Update card fields',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string' },
          sortOrder: { type: 'number' },
          startDate: { type: 'string' },
          estimatedTime: { type: 'number' },
          linkedHabitId: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        const cardId = asString(args.cardId, 'cardId')
        return boardService.updateCard(userId, cardId, {
          title: asOptionalString(args.title, 'title'),
          description: asOptionalString(args.description, 'description'),
          priority: asOptionalString(args.priority, 'priority'),
          sortOrder: asOptionalNumber(args.sortOrder, 'sortOrder'),
          startDate: asOptionalString(args.startDate, 'startDate'),
          estimatedTime: asOptionalNumber(args.estimatedTime, 'estimatedTime'),
          linkedHabitId: asOptionalString(args.linkedHabitId, 'linkedHabitId'),
        })
      },
    },
    {
      name: 'board_move_card',
      description: 'Move a card to another column and set sort order',
      inputSchema: {
        type: 'object',
        required: ['cardId', 'columnId', 'sortOrder'],
        properties: {
          cardId: { type: 'string' },
          columnId: { type: 'string' },
          sortOrder: { type: 'number' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return boardService.moveCard(
          userId,
          asString(args.cardId, 'cardId'),
          asString(args.columnId, 'columnId'),
          asOptionalNumber(args.sortOrder, 'sortOrder') ?? 0,
        )
      },
    },
    {
      name: 'board_delete_card',
      description: 'Delete a card permanently',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return boardService.deleteCard(userId, asString(args.cardId, 'cardId'))
      },
    },
    {
      name: 'board_add_column',
      description: 'Add a custom column to a board',
      inputSchema: {
        type: 'object',
        required: ['boardId', 'title'],
        properties: {
          boardId: { type: 'string' },
          title: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return boardService.addColumn(userId, asString(args.boardId, 'boardId'), asString(args.title, 'title'))
      },
    },
    {
      name: 'board_rename_column',
      description: 'Rename an existing column',
      inputSchema: {
        type: 'object',
        required: ['columnId', 'title'],
        properties: {
          columnId: { type: 'string' },
          title: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return boardService.renameColumn(userId, asString(args.columnId, 'columnId'), asString(args.title, 'title'))
      },
    },
    {
      name: 'board_delete_column',
      description: 'Delete a custom column (system default columns cannot be deleted)',
      inputSchema: {
        type: 'object',
        required: ['columnId'],
        properties: {
          columnId: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return boardService.deleteColumn(userId, asString(args.columnId, 'columnId'))
      },
    },
    {
      name: 'board_reorder_columns',
      description: 'Reorder columns by ordered column id list',
      inputSchema: {
        type: 'object',
        required: ['boardId', 'orderedIds'],
        properties: {
          boardId: { type: 'string' },
          orderedIds: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return boardService.reorderColumns(
          userId,
          asString(args.boardId, 'boardId'),
          asStringArray(args.orderedIds, 'orderedIds'),
        )
      },
    },
  ]
}