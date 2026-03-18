import {
  JSONRPC_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  PROTOCOL_VERSION,
} from './constants'
import { sendError, sendResponse } from './jsonRpc'
import type { JsonRpcRequest, ToolDefinition } from './types'
import { asString, isObject, normalizeError } from './utils'

export function createMessageHandler(tools: ToolDefinition[]) {
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))

  return async (message: JsonRpcRequest) => {
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
  }
}