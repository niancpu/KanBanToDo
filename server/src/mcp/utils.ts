import { READ_ONLY_MODE } from './constants'

export function writeStderr(message: string) {
  process.stderr.write(`${message}\n`)
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`"${key}" must be a non-empty string`)
  }
  return value
}

export function asOptionalString(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`"${key}" must be a string`)
  return value
}

export function asOptionalNumber(value: unknown, key: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`"${key}" must be a number`)
  return value
}

export function asStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`"${key}" must be an array of non-empty strings`)
  }
  return value
}

export function ensureWriteAllowed() {
  if (READ_ONLY_MODE) {
    throw new Error('Write operations are disabled because MCP_READ_ONLY=true')
  }
}

export function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10)
}