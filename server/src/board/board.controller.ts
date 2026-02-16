import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { BoardService } from './board.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('boards')
export class BoardController {
  constructor(private boardService: BoardService) {}

  @Get()
  getBoard(@Query('date') date: string, @CurrentUser() userId: string) {
    return this.boardService.getOrCreateBoard(userId, date);
  }

  @Post('cards')
  addCard(@CurrentUser() userId: string, @Body() body: any) {
    return this.boardService.addCard(userId, body);
  }

  @Put('cards/:id/move')
  moveCard(@CurrentUser() userId: string, @Param('id') id: string, @Body() body: { columnId: string; sortOrder: number }) {
    return this.boardService.moveCard(userId, id, body.columnId, body.sortOrder);
  }

  @Delete('cards/:id')
  deleteCard(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.boardService.deleteCard(userId, id);
  }
}
