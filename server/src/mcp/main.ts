import { NestFactory } from '@nestjs/core'
import { eq } from 'drizzle-orm'
import { AppModule } from '../app.module'
import { BoardService } from '../board/board.service'
import { HabitService } from '../habit/habit.service'
import { DB } from '../database/database.module'
import { users } from '../database/schema'

type JsonRpcId = string | number

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: ToolHandler
}

const PROTOCOL_VERSION = '2024-11-05'
const MCP_SERVER_NAME = 'kanban-todo-mcp'
const MCP_SERVER_VERSION = '0.1.0'
const JSONRPC_VERSION = '2.0'
const READ_ONLY_MODE = process.env.MCP_READ_ONLY === 'true'

function writeStderr(message: string) {
  process.stderr.write(`${message}\n`)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`"${key}" must be a non-empty string`)
  }
  return value
}

function asOptionalString(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`"${key}" must be a string`)
  return value
}

function asOptionalNumber(value: unknown, key: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`"${key}" must be a number`)
  return value
}

function asStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`"${key}" must be an array of non-empty strings`)
  }
  return value
}

function ensureWriteAllowed() {
  if (READ_ONLY_MODE) {
    throw new Error('Write operations are disabled because MCP_READ_ONLY=true')
  }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function buildTools(userId: string, boardService: BoardService, habitService: HabitService): ToolDefinition[] {
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

function writeJsonRpcMessage(payload: unknown) {
  const body = JSON.stringify(payload)
  const byteLength = Buffer.byteLength(body, 'utf8')
  process.stdout.write(`Content-Length: ${byteLength}\r\n\r\n${body}`)
}

class StdioJsonRpcServer {
  private buffer = Buffer.alloc(0)

  constructor(private onMessage: (message: JsonRpcRequest) => Promise<void>) {
    process.stdin.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      this.consumeBuffer().catch((error) => writeStderr(`MCP parser error: ${normalizeError(error)}`))
    })
  }

  private async consumeBuffer() {
    while (true) {
      const separatorIndex = this.buffer.indexOf('\r\n\r\n')
      if (separatorIndex === -1) return

      const headerText = this.buffer.subarray(0, separatorIndex).toString('utf8')
      const contentLengthLine = headerText
        .split('\r\n')
        .find((line) => line.toLowerCase().startsWith('content-length:'))

      if (!contentLengthLine) {
        writeStderr('Missing Content-Length header')
        this.buffer = this.buffer.subarray(separatorIndex + 4)
        continue
      }

      const contentLength = Number(contentLengthLine.split(':')[1]?.trim())
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        writeStderr('Invalid Content-Length header')
        this.buffer = this.buffer.subarray(separatorIndex + 4)
        continue
      }

      const totalMessageLength = separatorIndex + 4 + contentLength
      if (this.buffer.length < totalMessageLength) return

      const bodyBuffer = this.buffer.subarray(separatorIndex + 4, totalMessageLength)
      this.buffer = this.buffer.subarray(totalMessageLength)

      try {
        const message = JSON.parse(bodyBuffer.toString('utf8')) as JsonRpcRequest
        await this.onMessage(message)
      } catch (error) {
        writeStderr(`Invalid JSON-RPC payload: ${normalizeError(error)}`)
      }
    }
  }
}

function sendResponse(id: JsonRpcId, result: unknown) {
  const response: JsonRpcResponse = {
    jsonrpc: JSONRPC_VERSION,
    id,
    result,
  }
  writeJsonRpcMessage(response)
}

function sendError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  const response: JsonRpcResponse = {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: {
      code,
      message,
      data,
    },
  }
  writeJsonRpcMessage(response)
}

async function resolveUserId(app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>) {
  const envUserId = process.env.MCP_USER_ID?.trim()
  if (envUserId) return envUserId

  const username = process.env.MCP_USERNAME?.trim()
  if (!username) {
    throw new Error('Missing identity. Set MCP_USER_ID or MCP_USERNAME before starting MCP server.')
  }

  const db = app.get<any>(DB, { strict: false })
  const [user] = await db.select().from(users).where(eq(users.username, username))
  if (!user) throw new Error(`User "${username}" was not found`)
  return user.id as string
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
  const boardService = app.get(BoardService, { strict: false })
  const habitService = app.get(HabitService, { strict: false })
  const userId = await resolveUserId(app)
  const tools = buildTools(userId, boardService, habitService)

  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))

  new StdioJsonRpcServer(async (message) => {
    if (!message || message.jsonrpc !== JSONRPC_VERSION || typeof message.method !== 'string') {
      if (message?.id !== undefined) sendError(message.id, -32600, 'Invalid Request')
      return
    }

    const id = message.id
    const params = isObject(message.params) ? message.params : {}

    if (message.method === 'notifications/initialized') return

    if (id === undefined) return

    try {
      switch (message.method) {
        case 'initialize': {
          sendResponse(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: MCP_SERVER_NAME,
              version: MCP_SERVER_VERSION,
            },
            instructions:
              'This MCP server controls KanBanToDo board and habit data for one configured user.',
          })
          break
        }
        case 'ping': {
          sendResponse(id, {})
          break
        }
        case 'tools/list': {
          sendResponse(id, {
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          })
          break
        }
        case 'tools/call': {
          const toolName = asString(params.name, 'name')
          const tool = toolsByName.get(toolName)
          if (!tool) {
            sendResponse(id, {
              content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
              isError: true,
            })
            break
          }

          const toolArgs = isObject(params.arguments) ? params.arguments : {}
          try {
            const result = await tool.handler(toolArgs)
            const serialized = JSON.stringify(result, null, 2)
            sendResponse(id, {
              content: [{ type: 'text', text: serialized }],
              structuredContent: result,
              isError: false,
            })
          } catch (error) {
            sendResponse(id, {
              content: [{ type: 'text', text: normalizeError(error) }],
              isError: true,
            })
          }
          break
        }
        default: {
          sendError(id, -32601, `Method not found: ${message.method}`)
          break
        }
      }
    } catch (error) {
      sendError(id, -32603, 'Internal error', normalizeError(error))
    }
  })

  process.stdin.resume()
  writeStderr(`MCP server ready for user "${userId}"${READ_ONLY_MODE ? ' (read-only)' : ''}`)

  const shutdown = async () => {
    try {
      await app.close()
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((error) => {
  writeStderr(`MCP bootstrap failed: ${normalizeError(error)}`)
  process.exit(1)
})
