import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../users/users.service';

@WebSocketGateway({
  namespace: '/doctor-relay-realtime',
  cors: {
    origin: true,
  },
})
export class DoctorRelayGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DoctorRelayGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  afterInit() {
    this.logger.log('Doctor relay realtime gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user.tenantId && user.role !== 'super_admin') {
        client.disconnect();
        return;
      }

      client.data.user = user;
      if (user.tenantId) {
        client.join(`company:${user.tenantId}`);
      }
    } catch (error) {
      this.logger.warn(
        `Doctor relay socket auth failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect() {
    // no per-connection cleanup needed
  }

  emitLinkNew(companyId: string, payload: unknown) {
    this.server.to(`company:${companyId}`).emit('link:new', payload);
  }

  emitLinkUpdated(companyId: string, payload: unknown) {
    this.server.to(`company:${companyId}`).emit('link:updated', payload);
  }

  emitMessageNew(companyId: string, payload: unknown) {
    this.server.to(`company:${companyId}`).emit('message:new', payload);
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.trim()) {
      return header.replace(/^Bearer\s+/i, '');
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.replace(/^Bearer\s+/i, '');
    }

    throw new Error('Missing socket token');
  }
}
