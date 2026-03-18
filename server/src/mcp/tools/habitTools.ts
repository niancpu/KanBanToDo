import { HabitService } from '../../habit/habit.service'
import type { ToolDefinition } from '../types'
import { asOptionalNumber, asOptionalString, asString, ensureWriteAllowed } from '../utils'

export function buildHabitTools(userId: string, habitService: HabitService): ToolDefinition[] {
  return [
    {
      name: 'habit_list',
      description: 'List all habits for the active user',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      handler: async () => habitService.list(userId),
    },
    {
      name: 'habit_create',
      description: 'Create a habit',
      inputSchema: {
        type: 'object',
        required: ['title', 'frequency'],
        properties: {
          title: { type: 'string' },
          frequency: { type: 'string', description: 'daily, weekly, monthly, or custom' },
          description: { type: 'string' },
          customIntervalDays: { type: 'number' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return habitService.create(
          userId,
          asString(args.title, 'title'),
          asString(args.frequency, 'frequency'),
          asOptionalString(args.description, 'description'),
          asOptionalNumber(args.customIntervalDays, 'customIntervalDays'),
        )
      },
    },
    {
      name: 'habit_update',
      description: 'Update a habit',
      inputSchema: {
        type: 'object',
        required: ['habitId'],
        properties: {
          habitId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          frequency: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return habitService.update(userId, asString(args.habitId, 'habitId'), {
          title: asOptionalString(args.title, 'title'),
          description: asOptionalString(args.description, 'description'),
          frequency: asOptionalString(args.frequency, 'frequency'),
        })
      },
    },
    {
      name: 'habit_checkin',
      description: 'Check in a habit for a date',
      inputSchema: {
        type: 'object',
        required: ['habitId', 'date'],
        properties: {
          habitId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return habitService.checkIn(
          userId,
          asString(args.habitId, 'habitId'),
          asString(args.date, 'date'),
        )
      },
    },
    {
      name: 'habit_uncheckin',
      description: 'Remove a check-in record for a date',
      inputSchema: {
        type: 'object',
        required: ['habitId', 'date'],
        properties: {
          habitId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return habitService.uncheckIn(
          userId,
          asString(args.habitId, 'habitId'),
          asString(args.date, 'date'),
        )
      },
    },
    {
      name: 'habit_delete',
      description: 'Delete a habit and its records permanently',
      inputSchema: {
        type: 'object',
        required: ['habitId'],
        properties: {
          habitId: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        ensureWriteAllowed()
        return habitService.deleteHabit(userId, asString(args.habitId, 'habitId'))
      },
    },
    {
      name: 'habit_get_records',
      description: 'Get completion records for a habit',
      inputSchema: {
        type: 'object',
        required: ['habitId'],
        properties: {
          habitId: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (args) => habitService.getRecords(userId, asString(args.habitId, 'habitId')),
    },
  ]
}