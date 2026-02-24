import { pgTable, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  email: text('email'),
  emailVerified: boolean('email_verified').notNull().default(false),
  verificationCode: text('verification_code'),
  verificationCodeExpires: timestamp('verification_code_expires'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const boards = pgTable('boards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('boards_user_date_idx').on(t.userId, t.date),
]);

export const columns = pgTable('columns', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  defaultType: text('default_type'),
}, (t) => [
  index('columns_board_idx').on(t.boardId),
]);

export const cards = pgTable('cards', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id),
  columnId: text('column_id').notNull().references(() => columns.id),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority'),
  sortOrder: integer('sort_order').notNull().default(0),
  startDate: text('start_date'),
  estimatedTime: integer('estimated_time'),
  linkedHabitId: text('linked_habit_id'),
  isFromInheritance: boolean('is_from_inheritance').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('cards_board_idx').on(t.boardId),
]);

export const habits = pgTable('habits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  frequency: text('frequency').notNull().default('daily'),
  customIntervalDays: integer('custom_interval_days'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const habitRecords = pgTable('habit_records', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull().references(() => habits.id),
  date: text('date').notNull(),
  completed: boolean('completed').notNull().default(false),
}, (t) => [
  index('habit_records_habit_idx').on(t.habitId),
]);

export const opLog = pgTable('op_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  deviceId: text('device_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(),
  data: jsonb('data'),
  clock: integer('clock').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (t) => [
  index('op_log_user_clock_idx').on(t.userId, t.clock),
]);
