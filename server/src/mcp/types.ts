export type JsonRpcId = string | number

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method: string
  params?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: ToolHandler
}