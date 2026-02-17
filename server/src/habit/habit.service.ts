import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DB } from '../database/database.module';
import { habits, habitRecords } from '../database/schema';
import { v4 as uuid } from 'uuid';

@Injectable()
export class HabitService {
  constructor(@Inject(DB) private db: any) {}

  async list(userId: string) {
    return this.db.select().from(habits).where(eq(habits.userId, userId));
  }

  async create(userId: string, title: string, frequency: string, description?: string, customIntervalDays?: number) {
    const id = uuid();
    await this.db.insert(habits).values({ id, userId, title, description, frequency, customIntervalDays });
    return { id, userId, title, description, frequency, customIntervalDays, createdAt: new Date().toISOString() };
  }

  private async verifyHabitOwnership(habitId: string, userId: string) {
    const [habit] = await this.db.select().from(habits).where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
    if (!habit) throw new ForbiddenException('Habit not owned by user');
    return habit;
  }

  async update(userId: string, habitId: string, data: Partial<{ title: string; description: string; frequency: string }>) {
    await this.verifyHabitOwnership(habitId, userId);
    await this.db.update(habits).set(data).where(eq(habits.id, habitId));
  }

  async checkIn(userId: string, habitId: string, date: string) {
    await this.verifyHabitOwnership(habitId, userId);
    const id = uuid();
    await this.db.insert(habitRecords).values({ id, habitId, date, completed: true });
    return { id, habitId, date, completed: true };
  }

  async uncheckIn(userId: string, habitId: string, date: string) {
    await this.verifyHabitOwnership(habitId, userId);
    const [record] = await this.db.select().from(habitRecords)
      .where(and(eq(habitRecords.habitId, habitId), eq(habitRecords.date, date)));
    if (!record) return;
    await this.db.delete(habitRecords).where(eq(habitRecords.id, record.id));
  }

  async deleteHabit(userId: string, habitId: string) {
    await this.verifyHabitOwnership(habitId, userId);
    await this.db.delete(habitRecords).where(eq(habitRecords.habitId, habitId));
    await this.db.delete(habits).where(eq(habits.id, habitId));
  }

  async getRecords(userId: string, habitId: string) {
    await this.verifyHabitOwnership(habitId, userId);
    return this.db.select().from(habitRecords).where(eq(habitRecords.habitId, habitId));
  }
}
