import { Injectable, Inject } from '@nestjs/common';
import { gt, eq, and } from 'drizzle-orm';
import { DB } from '../database/database.module';
import { opLog } from '../database/schema';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SyncService {
  constructor(@Inject(DB) private db: any) {}

  async push(userId: string, operations: any[]) {
    for (const op of operations) {
      await this.db.insert(opLog).values({ id: uuid(), userId, ...op });
    }
    const maxClock = Math.max(...operations.map((o: any) => o.clock), 0);
    return { serverClock: maxClock, operations: [] };
  }

  async pull(userId: string, lastSyncClock: number) {
    const ops = await this.db.select().from(opLog)
      .where(and(gt(opLog.clock, lastSyncClock), eq(opLog.userId, userId)));
    const maxClock = ops.length ? Math.max(...ops.map((o: any) => o.clock)) : lastSyncClock;
    return { serverClock: maxClock, operations: ops };
  }
}
