import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../users/users.service';
import { AgentOnlineSession, AgentOnlineSessionDocument } from './schemas/agent-online-session.schema';

const SUPERVISING_ROLES = new Set(['super_admin', 'tenant_admin', 'admin', 'supervisor']);

export interface ConversationAudience {
  assignedToUserId?: string | null;
  /** Previous assignee on a reassignment — must also hear about it so the chat leaves their list. */
  previousAssignedToUserId?: string | null;
}

@WebSocketGateway({
  namespace: '/support-realtime',
  cors: {
    origin: true,
  },
})
export class SupportGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SupportGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @InjectModel(AgentOnlineSession.name)
    private readonly agentSessionModel: Model<AgentOnlineSessionDocument>,
  ) {}

  afterInit() {
    this.logger.log('Support realtime gateway initialized');
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
        // Conversation data is only pushed to people allowed to see it: supervisors and
        // above see everything; agents get unassigned conversations (agents room) and
        // their own (user room). See emitToConversationAudience.
        client.join(
          SUPERVISING_ROLES.has(user.role)
            ? `company:${user.tenantId}:supervisors`
            : `company:${user.tenantId}:agents`,
        );

        await this.agentSessionModel.create({
          userId: new Types.ObjectId(user.id),
          tenantId: new Types.ObjectId(user.tenantId),
          loginAt: new Date(),
          logoutAt: null,
          durationMinutes: null,
          socketId: client.id,
        });
      }
      client.join(`user:${user.id}`);
    } catch (error) {
      this.logger.warn(`Support socket auth failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user?.id && user?.tenantId) {
      const logoutAt = new Date();
      const session = await this.agentSessionModel.findOne({
        socketId: client.id,
        userId: new Types.ObjectId(user.id),
        logoutAt: null,
      });
      if (session) {
        const durationMinutes = Math.round(
          (logoutAt.getTime() - session.loginAt.getTime()) / 60000,
        );
        session.logoutAt = logoutAt;
        session.durationMinutes = durationMinutes;
        await session.save();
      }
      this.logger.debug(`Support socket disconnected for user ${user.id}`);
    }
  }

  @SubscribeMessage('conversation:join')
  handleConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (!body?.conversationId) {
      return;
    }

    client.join(`conversation:${body.conversationId}`);
  }

  @SubscribeMessage('conversation:leave')
  handleConversationLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (!body?.conversationId) {
      return;
    }

    client.leave(`conversation:${body.conversationId}`);
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = client.data.user;
    if (!user?.tenantId || !body?.conversationId) {
      return;
    }

    client.to(`conversation:${body.conversationId}`).emit('typing:start', {
      conversationId: body.conversationId,
      userId: user.id,
      userName: user.name,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = client.data.user;
    if (!user?.tenantId || !body?.conversationId) {
      return;
    }

    client.to(`conversation:${body.conversationId}`).emit('typing:stop', {
      conversationId: body.conversationId,
      userId: user.id,
      userName: user.name,
    });
  }

  emitWhatsappQr(companyId: string, payload: unknown) {
    this.server.to(`company:${companyId}`).emit('whatsapp:qr', payload);
  }

  emitWhatsappConnected(companyId: string, payload: unknown) {
    this.server.to(`company:${companyId}`).emit('whatsapp:connected', payload);
  }

  emitWhatsappDisconnected(companyId: string, payload: unknown) {
    this.server.to(`company:${companyId}`).emit('whatsapp:disconnected', payload);
  }

  /**
   * Sends a conversation-scoped event only to users who may see that conversation:
   * supervisors+, plus the assignee — or every agent when it is unassigned. Socket.IO
   * de-duplicates across rooms, so a user in two of them still receives one event.
   */
  private emitToConversationAudience(
    companyId: string,
    audience: ConversationAudience,
    event: string,
    payload: unknown,
  ) {
    const rooms = [`company:${companyId}:supervisors`];
    if (audience.assignedToUserId) {
      rooms.push(`user:${audience.assignedToUserId}`);
    } else {
      rooms.push(`company:${companyId}:agents`);
    }
    if (audience.previousAssignedToUserId) {
      rooms.push(`user:${audience.previousAssignedToUserId}`);
    }
    this.server.to(rooms).emit(event, payload);
  }

  emitConversationNew(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'conversation:new', payload);
  }

  emitConversationUpdated(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'conversation:updated', payload);
  }

  /**
   * Assignment changes affect list membership for everyone (unassigned tab, "mine", other
   * agents), so every company member is told — but only with ids, never conversation data.
   * Clients that may see the conversation refetch it through the scoped API.
   */
  emitConversationAssigned(
    companyId: string,
    payload: { conversationId: string; assignedToUserId: string | null; previousAssignedToUserId: string | null },
  ) {
    this.server.to(`company:${companyId}`).emit('conversation:assigned', payload);
  }

  emitConversationStatusChanged(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'conversation:status_changed', payload);
  }

  emitMessageNew(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'message:new', payload);
  }

  emitMessageUpdated(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'message:updated', payload);
  }

  emitMessageStatusUpdated(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'message:status_updated', payload);
  }

  emitNoteNew(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'note:new', payload);
  }

  emitNoteDeleted(companyId: string, audience: ConversationAudience, payload: unknown) {
    this.emitToConversationAudience(companyId, audience, 'note:deleted', payload);
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
