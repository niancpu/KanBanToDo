import type { INestApplicationContext } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB } from '../database/database.module'
import { users } from '../database/schema'

export async function resolveUserId(app: INestApplicationContext) {
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