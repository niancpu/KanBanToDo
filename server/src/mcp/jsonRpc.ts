import { JSONRPC_VERSION } from './constants'
import type { JsonRpcId, JsonRpcRequest, JsonRpcResponse } from './types'
import { normalizeError, writeStderr } from './utils'

function writeJsonRpcMessage(payload: unknown) {
  const body = JSON.stringify(payload)
  const byteLength = Buffer.byteLength(body, 'utf8')
  process.stdout.write(`Content-Length: ${byteLength}\r\n\r\n${body}`)
}

export class StdioJsonRpcServer {
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

export function sendResponse(id: JsonRpcId, result: unknown) {
  const response: JsonRpcResponse = {
    jsonrpc: JSONRPC_VERSION,
    id,
    result,
  }
  writeJsonRpcMessage(response)
}

export function sendError(id: JsonRpcId, code: number, message: string, data?: unknown) {
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