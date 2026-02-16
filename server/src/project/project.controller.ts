import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('projects')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get()
  list(@CurrentUser() userId: string) { return this.projectService.list(userId); }

  @Post()
  create(@CurrentUser() userId: string, @Body() body: { title: string; description?: string }) {
    return this.projectService.create(userId, body.title, body.description);
  }

  @Get(':id/wbs')
  getWbs(@CurrentUser() userId: string, @Param('id') id: string) { return this.projectService.getWbsTree(userId, id); }

  @Post(':id/wbs')
  addWbsNode(@CurrentUser() userId: string, @Param('id') projectId: string, @Body() body: any) {
    return this.projectService.addWbsNode(userId, { projectId, ...body });
  }

  @Put('wbs/:nodeId')
  updateWbsNode(@CurrentUser() userId: string, @Param('nodeId') id: string, @Body() body: any) {
    return this.projectService.updateWbsNode(userId, id, body);
  }
}
