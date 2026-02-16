import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { HabitService } from './habit.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('habits')
export class HabitController {
  constructor(private habitService: HabitService) {}

  @Get()
  list(@CurrentUser() userId: string) { return this.habitService.list(userId); }

  @Post()
  create(@CurrentUser() userId: string, @Body() body: { title: string; frequency: string; description?: string }) {
    return this.habitService.create(userId, body.title, body.frequency, body.description);
  }

  @Put(':id')
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body() body: { title?: string; description?: string; frequency?: string }) {
    return this.habitService.update(userId, id, body);
  }

  @Post(':id/checkin')
  checkIn(@CurrentUser() userId: string, @Param('id') id: string, @Body() body: { date: string }) {
    return this.habitService.checkIn(userId, id, body.date);
  }

  @Delete(':id/checkin')
  uncheckIn(@CurrentUser() userId: string, @Param('id') id: string, @Body() body: { date: string }) {
    return this.habitService.uncheckIn(userId, id, body.date);
  }

  @Get(':id/records')
  getRecords(@CurrentUser() userId: string, @Param('id') id: string) { return this.habitService.getRecords(userId, id); }
}
