import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { BoardService } from '../board/board.service'
import { HabitService } from '../habit/habit.service'
import { READ_ONLY_MODE } from './constants'
import { resolveUserId } from './identity'
import { StdioJsonRpcServer } from './jsonRpc'
import { createMessageHandler } from './messageHandler'
import { buildTools } from './tools'
import { normalizeError, writeStderr } from './utils'

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
  const boardService = app.get(BoardService, { strict: false })
  const habitService = app.get(HabitService, { strict: false })
  const userId = await resolveUserId(app)
  const tools = buildTools(userId, boardService, habitService)

  new StdioJsonRpcServer(createMessageHandler(tools))

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