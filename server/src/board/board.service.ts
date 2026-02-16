import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DB } from '../database/database.module';
import { boards, columns, cards } from '../database/schema';
import { v4 as uuid } from 'uuid';

@Injectable()
export class BoardService {
  constructor(@Inject(DB) private db: any) {}

  async getOrCreateBoard(userId: string, date: string) {
    let [board] = await this.db.select().from(boards).where(and(eq(boards.userId, userId), eq(boards.date, date)));
    if (!board) {
      const id = uuid();
      await this.db.insert(boards).values({ id, userId, date });
      const defaultCols = ['ToDo', 'Doing', 'Done', 'Dropped'];
      for (let i = 0; i < defaultCols.length; i++) {
        await this.db.insert(columns).values({ id: uuid(), boardId: id, title: defaultCols[i], sortOrder: i });
      }
      [board] = await this.db.select().from(boards).where(eq(boards.id, id));
    }
    const cols = await this.db.select().from(columns).where(eq(columns.boardId, board.id));
    const cardList = await this.db.select().from(cards).where(eq(cards.boardId, board.id));
    return { board, columns: cols, cards: cardList };
  }

  private async verifyBoardOwnership(boardId: string, userId: string) {
    const [board] = await this.db.select().from(boards).where(and(eq(boards.id, boardId), eq(boards.userId, userId)));
    if (!board) throw new ForbiddenException('Board not owned by user');
    return board;
  }

  async addCard(userId: string, data: { boardId: string; columnId: string; title: string; description?: string; priority?: string; sortOrder: number }) {
    await this.verifyBoardOwnership(data.boardId, userId);
    const id = uuid();
    await this.db.insert(cards).values({ id, ...data });
    return { id, ...data };
  }

  async moveCard(userId: string, cardId: string, columnId: string, sortOrder: number) {
    const [card] = await this.db.select().from(cards).where(eq(cards.id, cardId));
    if (!card) throw new ForbiddenException('Card not found');
    await this.verifyBoardOwnership(card.boardId, userId);
    await this.db.update(cards).set({ columnId, sortOrder, updatedAt: new Date() }).where(eq(cards.id, cardId));
  }

  async deleteCard(userId: string, cardId: string) {
    const [card] = await this.db.select().from(cards).where(eq(cards.id, cardId));
    if (!card) throw new ForbiddenException('Card not found');
    await this.verifyBoardOwnership(card.boardId, userId);
    await this.db.delete(cards).where(eq(cards.id, cardId));
  }
}
