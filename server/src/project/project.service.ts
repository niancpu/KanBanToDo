import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DB } from '../database/database.module';
import { projects, wbsNodes } from '../database/schema';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ProjectService {
  constructor(@Inject(DB) private db: any) {}

  async list(userId: string) {
    return this.db.select().from(projects).where(eq(projects.userId, userId));
  }

  async create(userId: string, title: string, description?: string) {
    const id = uuid();
    await this.db.insert(projects).values({ id, userId, title, description });
    return { id, title, description };
  }

  private async verifyProjectOwnership(projectId: string, userId: string) {
    const [project] = await this.db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!project) throw new ForbiddenException('Project not owned by user');
    return project;
  }

  async getWbsTree(userId: string, projectId: string) {
    await this.verifyProjectOwnership(projectId, userId);
    return this.db.select().from(wbsNodes).where(eq(wbsNodes.projectId, projectId));
  }

  async addWbsNode(userId: string, data: { projectId: string; parentId?: string; title: string; sortOrder: number }) {
    await this.verifyProjectOwnership(data.projectId, userId);
    const id = uuid();
    await this.db.insert(wbsNodes).values({ id, ...data });
    return { id, ...data };
  }

  async updateWbsNode(userId: string, id: string, data: Partial<{ title: string; startDate: string; endDate: string; progress: number }>) {
    const [node] = await this.db.select().from(wbsNodes).where(eq(wbsNodes.id, id));
    if (!node) throw new ForbiddenException('WBS node not found');
    await this.verifyProjectOwnership(node.projectId, userId);
    await this.db.update(wbsNodes).set(data).where(eq(wbsNodes.id, id));
  }
}
