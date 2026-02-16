import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SyncService } from './sync.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private syncService: SyncService, private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) throw new Error('No token');
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      (client as any).userId = userId;
      client.join(`user:${userId}`);
      console.log(`Client ${client.id} authenticated as ${userId}`);
    } catch {
      console.log(`Client ${client.id} auth failed, disconnecting`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('sync:push')
  async handlePush(client: Socket, payload: { operations: any[] }) {
    const userId = (client as any).userId;
    if (!userId) return;
    const result = await this.syncService.push(userId, payload.operations);
    // Broadcast to other devices of the same user
    client.to(`user:${userId}`).emit('sync:update', payload.operations);
    return result;
  }
}
