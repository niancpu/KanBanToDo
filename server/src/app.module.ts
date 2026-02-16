import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BoardModule } from './board/board.module';
import { ProjectModule } from './project/project.module';
import { HabitModule } from './habit/habit.module';
import { SyncModule } from './sync/sync.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'dev-secret', signOptions: { expiresIn: '7d' } }),
    DatabaseModule,
    AuthModule,
    BoardModule,
    ProjectModule,
    HabitModule,
    SyncModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
