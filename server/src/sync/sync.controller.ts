import { Controller, Post, Body } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('push')
  push(@CurrentUser() userId: string, @Body() body: { operations: any[]; lastSyncClock: number }) {
    return this.syncService.push(userId, body.operations);
  }

  @Post('pull')
  pull(@CurrentUser() userId: string, @Body() body: { lastSyncClock: number }) {
    return this.syncService.pull(userId, body.lastSyncClock);
  }
}
