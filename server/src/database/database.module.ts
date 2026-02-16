import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kanbantodo';

const connection = (postgres as any).default ? (postgres as any).default(DB_URL) : (postgres as any)(DB_URL);
const db = drizzle(connection, { schema });

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [{ provide: DB, useValue: db }],
  exports: [DB],
})
export class DatabaseModule {}
