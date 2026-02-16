import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncGateway],
})
export class SyncModule {}
