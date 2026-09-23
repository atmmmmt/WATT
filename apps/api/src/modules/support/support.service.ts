import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentOnlineSession, AgentOnlineSessionDocument } from './schemas/agent-online-session.schema';
import {
  hasSupportPermission,
  SupportPermission,
} from '../../common/utils/support-permissions.util';
import { TenantsService } from '../tenants/tenants.service';
import { TenantProduct } from '../tenants/schemas/tenant.schema';
import { UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import {
  IncomingWhatsappMessageEvent,
  WhatsappChatHistorySnapshot,
  WhatsappMessageAckEvent,
  WhatsappMessageEditEvent,
  WhatsappSessionUpdateEvent,
  WhatsappSessionsService,
} from '../whatsapp-sessions/whatsapp-sessions.service';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateConversationAiDto } from './dto/update-conversation-ai.dto';
import { SupportAiError, SupportAiService } from './support-ai.service';
import { ConversationAudience } from './support.gateway';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { CreateSupportEmployeeDto } from './dto/create-support-employee.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { UpdateConversationTagsDto } from './dto/update-conversation-tags.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';
import { UpdateSupportEmployeeDto } from './dto/update-support-employee.dto';
import { UpdateSupportSettingsDto } from './dto/update-support-settings.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import {
  SupportActivityLog,
  SupportActivityLogDocument,
} from './schemas/support-activity-log.schema';
import {
  SupportConversation,
  SupportConversationDocument,
  SupportAiStatus,
  SupportConversationPriority,
  SupportConversationStatus,
} from './schemas/support-conversation.schema';
import {
  SupportInternalNote,
  SupportInternalNoteDocument,
} from './schemas/support-internal-note.schema';
import {
  SupportMessage,
  SupportMessageDirection,
  SupportMessageDocument,
  SupportMessageStatus,
  SupportMessageType,
} from './schemas/support-message.schema';
import {
  SupportQuickReply,
  SupportQuickReplyDocument,
} from './schemas/support-quick-reply.schema';
import { SupportTag, SupportTagDocument } from './schemas/support-tag.schema';
import { SupportGateway } from './support.gateway';
import { MailerService } from '../mailer/mailer.service';
import { ConfigService } from '@nestjs/config';

export interface SupportUserContext {
  id: string;
  role: UserRole;
  tenantId: string | null;
  name: string;
  email: string;
  permissions?: string[];
}

interface SupportSettings {
  allowAgentClaimUnassigned: boolean;
  allowAgentViewUnassigned: boolean;
  allowSupervisorViewAll: boolean;
  aiEnabled: boolean;
  aiPauseOnHumanTakeover: boolean;
  aiInstructions: string;
  aiKnowledgeBase: string;
}

const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  allowAgentClaimUnassigned: true,
  allowAgentViewUnassigned: true,
  allowSupervisorViewAll: true,
  aiEnabled: false,
  aiPauseOnHumanTakeover: true,
  aiInstructions: '',
  aiKnowledgeBase: '',
};

/**
 * Safety-net reconciliation interval. Messages arrive in real time through client events;
 * this only catches what those miss, so polling Chrome every 30s was pure overhead on a
 * server running many sessions.
 */
const PERIODIC_SYNC_INTERVAL_MS = Number(process.env.SUPPORT_SYNC_INTERVAL_MS || 120000);

/** How far apart an agent's send and WhatsApp's echo of it may be and still be matched. */
const ECHO_MATCH_WINDOW_MS = 5 * 60 * 1000;

function isDuplicateKeyError(error: unknown) {
  return (error as { code?: number } | null)?.code === 11000;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** WhatsApp @lid ids are > 13 digits — not a phone number anyone can dial. */
function isRealPhone(value: string | null | undefined) {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 13;
}

@Injectable()
export class SupportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportService.name);
  private readonly syncTimers = new Map<string, ReturnType<typeof setInterval>>();
  private offIncomingMessage?: () => void;
  private offMessageAck?: () => void;
  private offSessionUpdate?: () => void;
  private offMessageEdit?: () => void;
  /** Conversations with an AI reply in flight — one reply at a time per conversation. */
  private readonly aiInFlight = new Set<string>();

  constructor(
    @InjectModel(SupportConversation.name)
    private readonly conversationModel: Model<SupportConversationDocument>,
    @InjectModel(SupportMessage.name)
    private readonly messageModel: Model<SupportMessageDocument>,
    @InjectModel(SupportInternalNote.name)
    private readonly noteModel: Model<SupportInternalNoteDocument>,
    @InjectModel(SupportActivityLog.name)
    private readonly activityLogModel: Model<SupportActivityLogDocument>,
    @InjectModel(SupportQuickReply.name)
    private readonly quickReplyModel: Model<SupportQuickReplyDocument>,
    @InjectModel(SupportTag.name)
    private readonly tagModel: Model<SupportTagDocument>,
    @InjectModel(AgentOnlineSession.name)
    private readonly agentSessionModel: Model<AgentOnlineSessionDocument>,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly whatsappSessionsService: WhatsappSessionsService,
    private readonly supportGateway: SupportGateway,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly supportAiService: SupportAiService,
  ) {}

  onModuleInit() {
    this.offIncomingMessage = this.whatsappSessionsService.onIncomingMessage((event) =>
      this.handleIncomingMessage(event),
    );
    this.offMessageAck = this.whatsappSessionsService.onMessageAck((event) =>
      this.handleMessageAck(event),
    );
    this.offSessionUpdate = this.whatsappSessionsService.onSessionUpdate((event) =>
      this.handleSessionUpdate(event),
    );
    this.offMessageEdit = this.whatsappSessionsService.onMessageEdit((event) =>
      this.handleMessageEdit(event),
    );
  }

  onModuleDestroy() {
    this.offIncomingMessage?.();
    this.offMessageAck?.();
    this.offSessionUpdate?.();
    this.offMessageEdit?.();
    for (const timer of this.syncTimers.values()) clearInterval(timer);
    this.syncTimers.clear();
  }

  async listEmployees(user: SupportUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, SupportPermission.EMPLOYEES_MANAGE);
    const employees = await this.usersService.listAllForTenant(effectiveCompanyId);
    return employees.filter((item) =>
      [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT].includes(item.role),
    );
  }

  async createEmployee(user: SupportUserContext, dto: CreateSupportEmployeeDto) {
    const companyId = await this.resolveCompanyId(user, dto.companyId);
    this.assertHasPermission(user, SupportPermission.EMPLOYEES_MANAGE);

    const dashboardOrigin = this.configService.get<string>('dashboardOrigin') || '';
    const tenant = await this.tenantsService.findById(companyId);

    if (dto.password) {
      // Admin provided password manually
      return this.usersService.createUser({
        tenantId: companyId,
        role: dto.role,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: dto.password,
        permissions: dto.permissions,
      });
    }

    // No password → send invite email
    const { user: newUser, inviteToken } = await this.usersService.createUserForInvite({
      tenantId: companyId,
      role: dto.role,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      permissions: dto.permissions,
    });

    const setPasswordUrl = `${dashboardOrigin}/set-password?token=${inviteToken}`;
    await this.mailerService.sendEmployeeInvite({
      to: newUser.email,
      name: newUser.name,
      companyName: tenant.name,
      setPasswordUrl,
    });

    return newUser;
  }

  async updateEmployee(
    user: SupportUserContext,
    employeeId: string,
    dto: UpdateSupportEmployeeDto,
  ) {
    const companyId = await this.resolveCompanyId(user);
    this.assertHasPermission(user, SupportPermission.EMPLOYEES_MANAGE);
    const employee = await this.usersService.findById(employeeId);

    if (String(employee.tenantId) !== String(companyId)) {
      throw new ForbiddenException('This employee does not belong to your company');
    }

    if (
      dto.role &&
      ![UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT].includes(dto.role)
    ) {
      throw new BadRequestException('Invalid support employee role');
    }

    return this.usersService.updateUser(employeeId, dto);
  }

  async disableEmployee(user: SupportUserContext, employeeId: string) {
    return this.updateEmployee(user, employeeId, { status: 'inactive' });
  }

  async deleteEmployee(user: SupportUserContext, employeeId: string) {
    const companyId = await this.resolveCompanyId(user);
    this.assertHasPermission(user, SupportPermission.EMPLOYEES_MANAGE);
    const employee = await this.usersService.findById(employeeId);
    if (String(employee.tenantId) !== String(companyId)) {
      throw new ForbiddenException('This employee does not belong to your company');
    }
    await this.usersService.deleteUser(employeeId);
    return { success: true };
  }

  async listConversations(user: SupportUserContext, query: ListConversationsDto) {
    const companyId = await this.resolveCompanyId(user, query.companyId);
    const filter = await this.buildConversationFilter(user, companyId, query);
    const conversations = await this.conversationModel
      .find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    return this.hydrateConversations(conversations);
  }

  async getConversation(user: SupportUserContext, conversationId: string) {
    const conversation = await this.getScopedConversation(user, conversationId);

    // Conversations first seen through a @lid chat were stored without a dialable number.
    // Resolve it now (when WhatsApp is connected) so the details panel can show it.
    if (!isRealPhone(conversation.customerPhone) && conversation.whatsappChatId) {
      const phone = await this.whatsappSessionsService.resolveContactPhone(
        String(conversation.companyId),
        conversation.whatsappChatId,
      );
      if (phone && isRealPhone(phone)) {
        conversation.customerPhone = phone;
        await conversation.save();
      }
    }

    const [hydratedConversation] = await this.hydrateConversations([conversation.toObject()]);
    return hydratedConversation || conversation;
  }

  async listMessages(user: SupportUserContext, conversationId: string, after?: string) {
    const conversation = await this.getScopedConversation(user, conversationId);
    const filter: Record<string, unknown> = {
      conversationId: conversation._id,
      companyId: conversation.companyId,
    };
    // Incremental fetch: when the client passes the timestamp of the last message it
    // already has, return only newer ones — a tiny payload that makes 1s polling cheap.
    if (after) {
      const afterDate = new Date(after);
      if (!Number.isNaN(afterDate.getTime())) {
        filter.createdAt = { $gt: afterDate };
      }
    }
    return this.messageModel.find(filter).sort({ createdAt: 1 }).lean();
  }

  async markConversationRead(user: SupportUserContext, conversationId: string) {
    const conversation = await this.getScopedConversation(user, conversationId);
    if (!conversation.unreadCount) {
      return { success: true };
    }
    conversation.unreadCount = 0;
    await conversation.save();
    this.supportGateway.emitConversationUpdated(
      String(conversation.companyId),
      this.audienceOf(conversation),
      {
        conversationId: conversation.id,
        conversation: await this.serializeConversation(conversation.toObject()),
      },
    );
    return { success: true };
  }

  async sendMessage(
    user: SupportUserContext,
    conversationId: string,
    dto: SendSupportMessageDto,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.CONVERSATIONS_REPLY);
    const companyId = String(conversation.companyId);
    const renderedMessage = await this.buildOutgoingMessage(companyId, dto, conversation);

    if (!renderedMessage.trim()) {
      throw new BadRequestException('Message body is required');
    }

    // Idempotency: a repeated request (double click, network retry) with the same key
    // returns the message that already exists and never reaches WhatsApp a second time.
    const clientMessageId = dto.clientMessageId || null;
    if (clientMessageId) {
      const existing = await this.messageModel
        .findOne({ companyId: conversation.companyId, clientMessageId })
        .lean();
      if (existing) {
        return {
          message: existing,
          conversation: await this.serializeConversation(conversation.toObject()),
          duplicate: true,
        };
      }
    }

    const session = await this.whatsappSessionsService.getSession(companyId);
    const whatsappSessionId = this.extractSessionObjectId(session);

    let pendingMessage: SupportMessageDocument;
    try {
      // Created BEFORE calling WhatsApp: its echo (message_create) can arrive before
      // sendMessage() resolves, and must find this record to attach to rather than being
      // stored again as a "sent from phone" message.
      pendingMessage = await this.messageModel.create({
        companyId: conversation.companyId,
        conversationId: conversation._id,
        whatsappSessionId,
        whatsappMessageId: null,
        clientMessageId,
        direction: SupportMessageDirection.OUTGOING,
        messageType: SupportMessageType.TEXT,
        body: renderedMessage,
        mediaUrl: null,
        mediaMimeType: null,
        mediaFileName: null,
        sentByUserId: new Types.ObjectId(user.id),
        sentByUserNameSnapshot: user.name,
        status: SupportMessageStatus.PENDING,
        errorMessage: null,
        providerTimestamp: new Date(),
      });
    } catch (error) {
      if (clientMessageId && isDuplicateKeyError(error)) {
        // A concurrent request with the same key won the race — it is doing the send.
        const existing = await this.messageModel
          .findOne({ companyId: conversation.companyId, clientMessageId })
          .lean();
        return {
          message: existing,
          conversation: await this.serializeConversation(conversation.toObject()),
          duplicate: true,
        };
      }
      throw error;
    }

    try {
      const result = await this.whatsappSessionsService.sendTextMessage(
        companyId,
        conversation.whatsappChatId,
        renderedMessage,
      );

      const confirmed = await this.confirmOutgoingSend(pendingMessage, result.providerMessageId);

      const now = new Date();
      const previousAssignee = conversation.assignedToUserId ? String(conversation.assignedToUserId) : null;
      conversation.lastMessage = renderedMessage;
      conversation.lastMessageAt = now;
      conversation.unreadCount = 0;
      conversation.firstResponseAt = conversation.firstResponseAt || now;
      if (!conversation.assignedToUserId) {
        conversation.assignedToUserId = new Types.ObjectId(user.id);
      }
      if (conversation.status === SupportConversationStatus.CLOSED) {
        conversation.status = SupportConversationStatus.OPEN;
        conversation.closedAt = null;
        conversation.closedByUserId = null;
      }
      await this.applyHumanTakeover(conversation);
      await conversation.save();

      await this.createActivityLog(companyId, {
        userId: user.id,
        action: 'message.sent',
        conversationId,
        metadata: {
          whatsappMessageId: confirmed.whatsappMessageId,
        },
      });

      const serializedConversation = await this.serializeConversation(conversation.toObject());
      const audience = this.audienceOf(conversation, previousAssignee);
      this.supportGateway.emitMessageNew(companyId, audience, {
        conversationId,
        message: confirmed,
      });
      this.supportGateway.emitConversationUpdated(companyId, audience, {
        conversationId,
        conversation: serializedConversation,
      });
      if (!previousAssignee && conversation.assignedToUserId) {
        this.supportGateway.emitConversationAssigned(companyId, {
          conversationId,
          assignedToUserId: String(conversation.assignedToUserId),
          previousAssignedToUserId: null,
        });
      }

      this.logger.log(`Outgoing support message sent by user ${user.id}`);

      return {
        message: confirmed,
        conversation: serializedConversation,
      };
    } catch (error) {
      await this.messageModel.updateOne(
        { _id: pendingMessage._id },
        {
          $set: {
            status: SupportMessageStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Failed to send message',
          },
        },
      );

      await this.createActivityLog(companyId, {
        userId: user.id,
        action: 'message.failed',
        conversationId,
        metadata: {
          error: error instanceof Error ? error.message : 'Failed to send message',
        },
      });

      const failed = await this.messageModel.findById(pendingMessage._id).lean();
      this.supportGateway.emitMessageNew(companyId, this.audienceOf(conversation), {
        conversationId,
        message: failed,
      });
      this.logger.warn(`Outgoing support message failed for user ${user.id}`);
      throw error;
    }
  }

  /**
   * Marks an agent/AI message as sent. The provider id is only written if WhatsApp's echo
   * has not already attached one (the echo can win the race), so the record keeps a
   * single id and no second copy is ever created.
   */
  private async confirmOutgoingSend(message: SupportMessageDocument, providerMessageId: string | null) {
    const realId =
      providerMessageId && providerMessageId !== 'sent-unmodelled' ? providerMessageId : null;

    if (realId) {
      try {
        // A fully-qualified id ("true_<chat>@c.us_<id>") is exactly what the echo will
        // carry, so the echo is recognised by id and no body matching is needed.
        await this.messageModel.updateOne(
          { _id: message._id, whatsappMessageId: null },
          { $set: { whatsappMessageId: realId, providerEchoMatched: realId.includes('@') } },
        );
      } catch (error) {
        // Another record already holds this id — only possible if an echo was stored
        // before this send was created. Keep ours and drop that stray copy.
        if (!isDuplicateKeyError(error)) throw error;
        const stray = await this.messageModel.findOneAndDelete({
          companyId: message.companyId,
          whatsappMessageId: realId,
          _id: { $ne: message._id },
          sentByUserId: null,
        });
        if (stray) {
          this.supportGateway.emitMessageUpdated(String(message.companyId), {}, {
            conversationId: String(stray.conversationId),
            removedMessageId: String(stray._id),
          });
          await this.messageModel.updateOne(
            { _id: message._id, whatsappMessageId: null },
            { $set: { whatsappMessageId: realId } },
          );
        }
      }
    }

    await this.messageModel.updateOne(
      { _id: message._id, status: SupportMessageStatus.PENDING },
      { $set: { status: SupportMessageStatus.SENT } },
    );
    const fresh = await this.messageModel.findById(message._id).lean();
    return fresh ?? message.toObject();
  }

  async sendMediaMessage(
    user: SupportUserContext,
    conversationId: string,
    base64Data: string,
    mimetype: string,
    filename: string,
    caption?: string,
    clientMessageId?: string,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.CONVERSATIONS_REPLY);
    const companyId = String(conversation.companyId);

    if (clientMessageId) {
      const existing = await this.messageModel
        .findOne({ companyId: conversation.companyId, clientMessageId })
        .lean();
      if (existing) return { message: existing, duplicate: true };
    }

    const session = await this.whatsappSessionsService.getSession(companyId);
    const whatsappSessionId = this.extractSessionObjectId(session);

    const isImage = mimetype.startsWith('image/');
    const msgType = isImage ? SupportMessageType.IMAGE : SupportMessageType.DOCUMENT;

    let pendingMessage: SupportMessageDocument;
    try {
      pendingMessage = await this.messageModel.create({
        companyId: conversation.companyId,
        conversationId: conversation._id,
        whatsappSessionId,
        whatsappMessageId: null,
        clientMessageId: clientMessageId || null,
        direction: SupportMessageDirection.OUTGOING,
        messageType: msgType,
        body: caption || '',
        mediaUrl: null,  // base64 not stored in DB to avoid 16MB document limit
        mediaMimeType: mimetype,
        mediaFileName: filename,
        sentByUserId: new Types.ObjectId(user.id),
        sentByUserNameSnapshot: user.name,
        status: SupportMessageStatus.PENDING,
        errorMessage: null,
        providerTimestamp: new Date(),
      });
    } catch (error) {
      if (clientMessageId && isDuplicateKeyError(error)) {
        const existing = await this.messageModel
          .findOne({ companyId: conversation.companyId, clientMessageId })
          .lean();
        return { message: existing, duplicate: true };
      }
      throw error;
    }

    try {
      const result = await this.whatsappSessionsService.sendMediaMessage(
        companyId,
        conversation.whatsappChatId,
        base64Data,
        mimetype,
        filename,
        caption,
      );

      const confirmed = await this.confirmOutgoingSend(pendingMessage, result.providerMessageId);

      const now = new Date();
      const previousAssignee = conversation.assignedToUserId ? String(conversation.assignedToUserId) : null;
      conversation.lastMessage = caption || `[${isImage ? 'صورة' : 'ملف'}]`;
      conversation.lastMessageAt = now;
      conversation.unreadCount = 0;
      conversation.firstResponseAt = conversation.firstResponseAt || now;
      if (!conversation.assignedToUserId) {
        conversation.assignedToUserId = new Types.ObjectId(user.id);
      }
      if (conversation.status === SupportConversationStatus.CLOSED) {
        conversation.status = SupportConversationStatus.OPEN;
        conversation.closedAt = null;
        conversation.closedByUserId = null;
      }
      await this.applyHumanTakeover(conversation);
      await conversation.save();

      const audience = this.audienceOf(conversation, previousAssignee);
      this.supportGateway.emitMessageNew(companyId, audience, { conversationId, message: confirmed });
      this.supportGateway.emitConversationUpdated(companyId, audience, {
        conversationId,
        conversation: await this.serializeConversation(conversation.toObject()),
      });
      if (!previousAssignee && conversation.assignedToUserId) {
        this.supportGateway.emitConversationAssigned(companyId, {
          conversationId,
          assignedToUserId: String(conversation.assignedToUserId),
          previousAssignedToUserId: null,
        });
      }

      return { message: confirmed };
    } catch (error) {
      await this.messageModel.updateOne(
        { _id: pendingMessage._id },
        {
          $set: {
            status: SupportMessageStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Failed to send media',
          },
        },
      );
      const failed = await this.messageModel.findById(pendingMessage._id).lean();
      this.supportGateway.emitMessageNew(companyId, this.audienceOf(conversation), { conversationId, message: failed });
      throw error;
    }
  }

  async updateContact(user: SupportUserContext, conversationId: string, dto: UpdateContactDto) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.CONTACTS_EDIT);

    const previous = conversation.customName;
    const next = dto.customName.trim() || null;
    conversation.customName = next;
    await conversation.save();

    await this.createActivityLog(String(conversation.companyId), {
      userId: user.id,
      action: 'contact.renamed',
      conversationId,
      metadata: { previousCustomName: previous, customName: next },
    });

    const serializedConversation = await this.serializeConversation(conversation.toObject());
    this.supportGateway.emitConversationUpdated(String(conversation.companyId), this.audienceOf(conversation), {
      conversationId,
      conversation: serializedConversation,
    });
    return serializedConversation;
  }

  async updateConversationAi(
    user: SupportUserContext,
    conversationId: string,
    dto: UpdateConversationAiDto,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.AI_MANAGE);

    conversation.aiStatus =
      dto.status === 'paused' ? SupportAiStatus.PAUSED : SupportAiStatus.ACTIVE;
    conversation.aiLastError = null;
    conversation.aiUpdatedAt = new Date();
    await conversation.save();

    await this.createActivityLog(String(conversation.companyId), {
      userId: user.id,
      action: dto.status === 'paused' ? 'ai.paused' : 'ai.resumed',
      conversationId,
    });

    const serializedConversation = await this.serializeConversation(conversation.toObject());
    this.supportGateway.emitConversationUpdated(String(conversation.companyId), this.audienceOf(conversation), {
      conversationId,
      conversation: serializedConversation,
    });
    return serializedConversation;
  }

  async assignConversation(
    user: SupportUserContext,
    conversationId: string,
    dto: AssignConversationDto,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.CONVERSATIONS_ASSIGN);

    const assignee = await this.usersService.findById(dto.assignedToUserId);
    if (String(assignee.tenantId) !== String(conversation.companyId)) {
      throw new ForbiddenException('The selected employee belongs to another company');
    }
    if (assignee.status !== 'active') {
      throw new BadRequestException('لا يمكن التعيين لموظف غير نشط');
    }

    return this.changeAssignee(user, conversation, dto.assignedToUserId, 'conversation.assigned');
  }

  async unassignConversation(user: SupportUserContext, conversationId: string) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.CONVERSATIONS_ASSIGN);
    return this.changeAssignee(user, conversation, null, 'conversation.unassigned');
  }

  async claimConversation(user: SupportUserContext, conversationId: string) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.CONVERSATIONS_CLAIM);
    const settings = await this.getSupportSettings(String(conversation.companyId));

    if (!settings.allowAgentClaimUnassigned) {
      throw new ForbiddenException('Agents are not allowed to claim conversations');
    }

    // Atomic: two agents claiming at the same moment can't both win.
    const claimed = await this.conversationModel.findOneAndUpdate(
      { _id: conversation._id, companyId: conversation.companyId, assignedToUserId: null },
      { $set: { assignedToUserId: new Types.ObjectId(user.id) } },
      { new: true },
    );
    if (!claimed) {
      throw new BadRequestException('Conversation is already assigned');
    }

    return this.changeAssignee(user, claimed, user.id, 'conversation.claimed', null);
  }

  /**
   * Single path for every assignment change so the list membership update reaches the
   * old assignee, the new one, the unassigned pool and supervisors consistently.
   */
  private async changeAssignee(
    user: SupportUserContext,
    conversation: SupportConversationDocument,
    nextAssigneeId: string | null,
    action: string,
    previousOverride?: string | null,
  ) {
    const companyId = String(conversation.companyId);
    const previousAssignee =
      previousOverride !== undefined
        ? previousOverride
        : conversation.assignedToUserId
          ? String(conversation.assignedToUserId)
          : null;

    conversation.assignedToUserId = nextAssigneeId ? new Types.ObjectId(nextAssigneeId) : null;
    if (nextAssigneeId) {
      await this.applyHumanTakeover(conversation);
    }
    await conversation.save();

    await this.createActivityLog(companyId, {
      userId: user.id,
      action,
      conversationId: conversation.id,
      metadata: { assignedToUserId: nextAssigneeId, previousAssignedToUserId: previousAssignee },
    });

    const serializedConversation = await this.serializeConversation(conversation.toObject());
    this.supportGateway.emitConversationAssigned(companyId, {
      conversationId: conversation.id,
      assignedToUserId: nextAssigneeId,
      previousAssignedToUserId: previousAssignee,
    });
    this.supportGateway.emitConversationUpdated(
      companyId,
      this.audienceOf(conversation, previousAssignee),
      { conversationId: conversation.id, conversation: serializedConversation },
    );

    return serializedConversation;
  }

  async updateConversationStatus(
    user: SupportUserContext,
    conversationId: string,
    dto: UpdateConversationStatusDto,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.CONVERSATIONS_CLOSE);
    const previousStatus = conversation.status;
    conversation.status = dto.status;

    if (dto.status === SupportConversationStatus.CLOSED) {
      conversation.closedAt = new Date();
      conversation.closedByUserId = new Types.ObjectId(user.id);
    } else {
      conversation.closedAt = null;
      conversation.closedByUserId = null;
    }

    await conversation.save();

    await this.createActivityLog(String(conversation.companyId), {
      userId: user.id,
      action: 'conversation.status_changed',
      conversationId,
      metadata: {
        previousStatus,
        nextStatus: dto.status,
      },
    });

    const serializedConversation = await this.serializeConversation(conversation.toObject());
    this.supportGateway.emitConversationStatusChanged(
      String(conversation.companyId),
      this.audienceOf(conversation),
      {
        conversationId,
        previousStatus,
        status: dto.status,
        conversation: serializedConversation,
      },
    );

    return serializedConversation;
  }

  async listNotes(user: SupportUserContext, conversationId: string) {
    const conversation = await this.getScopedConversation(user, conversationId);
    const notes = await this.noteModel
      .find({
        companyId: conversation.companyId,
        conversationId: conversation._id,
      })
      .sort({ createdAt: -1 })
      .lean();

    return this.hydrateNotes(notes, String(conversation.companyId));
  }

  async createNote(
    user: SupportUserContext,
    conversationId: string,
    dto: CreateInternalNoteDto,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.NOTES_MANAGE);
    const text = dto.note?.trim();
    if (!text) {
      throw new BadRequestException('Note is required');
    }
    // Internal notes are only ever stored and pushed to staff sockets — they never
    // go through WhatsApp.
    const note = await this.noteModel.create({
      companyId: conversation.companyId,
      conversationId: conversation._id,
      userId: new Types.ObjectId(user.id),
      note: text,
    });

    await this.createActivityLog(String(conversation.companyId), {
      userId: user.id,
      action: 'note.created',
      conversationId,
      metadata: { noteId: note.id },
    });

    const serializedNote = await this.serializeNote(note.toObject(), String(conversation.companyId));
    this.supportGateway.emitNoteNew(String(conversation.companyId), this.audienceOf(conversation), {
      conversationId,
      note: serializedNote,
    });

    return serializedNote;
  }

  async deleteNote(user: SupportUserContext, noteId: string) {
    this.assertHasPermission(user, SupportPermission.NOTES_MANAGE);
    const companyId = await this.resolveCompanyId(user);
    const note = await this.noteModel.findOneAndDelete({
      _id: new Types.ObjectId(noteId),
      companyId: new Types.ObjectId(companyId),
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const conversation = await this.conversationModel.findById(note.conversationId);
    if (conversation) {
      this.supportGateway.emitNoteDeleted(companyId, this.audienceOf(conversation), {
        conversationId: String(note.conversationId),
        noteId,
      });
    }

    return { success: true };
  }

  async listQuickReplies(user: SupportUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    return this.quickReplyModel
      .find({ companyId: new Types.ObjectId(effectiveCompanyId) })
      .sort({ category: 1, title: 1 })
      .lean();
  }

  async createQuickReply(user: SupportUserContext, dto: CreateQuickReplyDto) {
    const companyId = await this.resolveCompanyId(user, dto.companyId);
    this.assertHasPermission(user, SupportPermission.QUICK_REPLIES_MANAGE);
    return this.quickReplyModel.create({
      companyId: new Types.ObjectId(companyId),
      title: dto.title,
      message: dto.message,
      category: dto.category || 'general',
      isActive: true,
      createdByUserId: new Types.ObjectId(user.id),
    });
  }

  async updateQuickReply(
    user: SupportUserContext,
    quickReplyId: string,
    dto: UpdateQuickReplyDto,
  ) {
    const companyId = await this.resolveCompanyId(user);
    this.assertHasPermission(user, SupportPermission.QUICK_REPLIES_MANAGE);
    const quickReply = await this.quickReplyModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(quickReplyId),
        companyId: new Types.ObjectId(companyId),
      },
      dto,
      { new: true },
    );

    if (!quickReply) {
      throw new NotFoundException('Quick reply not found');
    }

    return quickReply;
  }

  async deleteQuickReply(user: SupportUserContext, quickReplyId: string) {
    const companyId = await this.resolveCompanyId(user);
    this.assertHasPermission(user, SupportPermission.QUICK_REPLIES_MANAGE);
    const quickReply = await this.quickReplyModel.findOneAndDelete({
      _id: new Types.ObjectId(quickReplyId),
      companyId: new Types.ObjectId(companyId),
    });

    if (!quickReply) {
      throw new NotFoundException('Quick reply not found');
    }

    return { success: true };
  }

  async listTags(user: SupportUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    return this.tagModel
      .find({ companyId: new Types.ObjectId(effectiveCompanyId) })
      .sort({ name: 1 })
      .lean();
  }

  async createTag(user: SupportUserContext, dto: CreateTagDto) {
    const companyId = await this.resolveCompanyId(user, dto.companyId);
    this.assertHasPermission(user, SupportPermission.TAGS_MANAGE);
    return this.tagModel.create({
      companyId: new Types.ObjectId(companyId),
      name: dto.name,
      color: dto.color || '#14532d',
    });
  }

  async updateTag(user: SupportUserContext, tagId: string, dto: UpdateTagDto) {
    const companyId = await this.resolveCompanyId(user);
    this.assertHasPermission(user, SupportPermission.TAGS_MANAGE);
    const tag = await this.tagModel.findOneAndUpdate(
      { _id: new Types.ObjectId(tagId), companyId: new Types.ObjectId(companyId) },
      dto,
      { new: true },
    );

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async deleteTag(user: SupportUserContext, tagId: string) {
    const companyId = await this.resolveCompanyId(user);
    this.assertHasPermission(user, SupportPermission.TAGS_MANAGE);
    const tag = await this.tagModel.findOneAndDelete({
      _id: new Types.ObjectId(tagId),
      companyId: new Types.ObjectId(companyId),
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.conversationModel.updateMany(
      { companyId: new Types.ObjectId(companyId) },
      { $pull: { tagIds: tag._id } },
    );

    return { success: true };
  }

  async updateConversationTags(
    user: SupportUserContext,
    conversationId: string,
    dto: UpdateConversationTagsDto,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.TAGS_MANAGE);
    conversation.tagIds = dto.tagIds.map((tagId) => new Types.ObjectId(tagId));
    await conversation.save();
    const serializedConversation = await this.serializeConversation(conversation.toObject());
    this.supportGateway.emitConversationUpdated(String(conversation.companyId), this.audienceOf(conversation), {
      conversationId,
      conversation: serializedConversation,
    });
    return serializedConversation;
  }

  async removeConversationTag(
    user: SupportUserContext,
    conversationId: string,
    tagId: string,
  ) {
    const conversation = await this.getScopedConversation(user, conversationId);
    this.assertHasPermission(user, SupportPermission.TAGS_MANAGE);
    conversation.tagIds = conversation.tagIds.filter(
      (item) => String(item) !== tagId,
    );
    await conversation.save();
    const serializedConversation = await this.serializeConversation(conversation.toObject());
    this.supportGateway.emitConversationUpdated(String(conversation.companyId), this.audienceOf(conversation), {
      conversationId,
      conversation: serializedConversation,
    });
    return serializedConversation;
  }

  async getSettings(user: SupportUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    return {
      ...(await this.getSupportSettings(effectiveCompanyId)),
      aiConfigured: this.supportAiService.isConfigured(),
    };
  }

  async updateSettings(
    user: SupportUserContext,
    dto: UpdateSupportSettingsDto,
    companyId?: string,
  ) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, SupportPermission.SETTINGS_MANAGE);
    const tenant = await this.tenantsService.findById(effectiveCompanyId);
    const settings = this.mergeSupportSettings(tenant.settings);
    const nextSettings = {
      ...settings,
      ...dto,
    };

    await this.tenantsService.updateSettings(effectiveCompanyId, {
      ...(tenant.settings || {}),
      support: nextSettings,
    });

    return { ...nextSettings, aiConfigured: this.supportAiService.isConfigured() };
  }

  async syncWhatsappHistory(user: SupportUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, SupportPermission.WHATSAPP_MANAGE);
    return this._internalSyncWhatsappHistory(effectiveCompanyId, user.id);
  }

  private async _periodicSync(companyId: string) {
    // Lightweight reconciliation only — skip the expensive full-list scroll. Real-time
    // messages already arrive via client 'message' / 'message_create' events; this just
    // catches anything those might miss (e.g. messages sent from the phone, edits).
    const chats = await this.whatsappSessionsService.listRecentChats(companyId, {
      chatLimit: 10,
      messageLimit: 5,
      skipScroll: true,
    });
    const session = await this.whatsappSessionsService.getSession(companyId);
    const whatsappSessionId = this.extractSessionObjectId(session);

    for (const chat of chats) {
      const result = await this.syncSingleWhatsappChat(companyId, whatsappSessionId, chat);
      if (!result.insertedDocs.length && !result.updatedDocs.length) continue;

      const conv = await this.conversationModel.findById(result.conversationId);
      if (!conv) continue;
      const audience = this.audienceOf(conv);

      for (const doc of result.insertedDocs) {
        this.supportGateway.emitMessageNew(companyId, audience, {
          conversationId: result.conversationId,
          message: doc.toObject ? doc.toObject() : doc,
        });
      }
      for (const doc of result.updatedDocs) {
        this.supportGateway.emitMessageUpdated(companyId, audience, {
          conversationId: result.conversationId,
          message: doc,
        });
      }
      const serialized = await this.serializeConversation(conv.toObject());
      if (result.importedConversation) {
        this.supportGateway.emitConversationNew(companyId, audience, { conversation: serialized });
      } else {
        this.supportGateway.emitConversationUpdated(companyId, audience, {
          conversationId: result.conversationId,
          conversation: serialized,
        });
      }
    }
  }

  private async _internalSyncWhatsappHistory(companyId: string, userId?: string) {
    const chats = await this.whatsappSessionsService.listRecentChats(companyId, {
      chatLimit: 200,
      messageLimit: 50,
    });
    const session = await this.whatsappSessionsService.getSession(companyId);
    const whatsappSessionId = this.extractSessionObjectId(session);

    let importedConversations = 0;
    let importedMessages = 0;

    for (const chat of chats) {
      const result = await this.syncSingleWhatsappChat(
        companyId,
        whatsappSessionId,
        chat,
      );
      importedConversations += result.importedConversation ? 1 : 0;
      importedMessages += result.importedMessages;
    }

    await this.createActivityLog(companyId, {
      userId,
      action: 'support.history_synced',
      metadata: {
        importedConversations,
        importedMessages,
      },
    });

    return {
      success: true,
      importedConversations,
      importedMessages,
      scannedChats: chats.length,
    };
  }

  async reportSummary(
    user: SupportUserContext,
    from?: string,
    to?: string,
    companyId?: string,
  ) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, SupportPermission.REPORTS_VIEW);
    const { fromDate, toDate } = this.resolveDateRange(from, to);
    const companyObjectId = new Types.ObjectId(effectiveCompanyId);
    const conversationFilter: Record<string, unknown> = {
      companyId: companyObjectId,
      createdAt: { $gte: fromDate, $lte: toDate },
    };
    const messageFilter: Record<string, unknown> = {
      companyId: companyObjectId,
      createdAt: { $gte: fromDate, $lte: toDate },
    };

    const [
      totalConversations,
      openConversations,
      pendingConversations,
      closedConversations,
      totalMessages,
      conversations,
      messages,
      employees,
    ] = await Promise.all([
      this.conversationModel.countDocuments(conversationFilter),
      this.conversationModel.countDocuments({
        ...conversationFilter,
        status: SupportConversationStatus.OPEN,
      }),
      this.conversationModel.countDocuments({
        ...conversationFilter,
        status: SupportConversationStatus.PENDING,
      }),
      this.conversationModel.countDocuments({
        ...conversationFilter,
        status: SupportConversationStatus.CLOSED,
      }),
      this.messageModel.countDocuments(messageFilter),
      this.conversationModel.find(conversationFilter).lean(),
      this.messageModel.find(messageFilter).lean(),
      this.usersService.listAllForTenant(effectiveCompanyId),
    ]);

    const supportEmployees = employees.filter((employee) =>
      [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT].includes(employee.role),
    );

    const messagesByEmployee = supportEmployees.map((employee) => ({
      employeeId: employee.id,
      name: employee.name,
      count: messages.filter(
        (message) =>
          message.direction === SupportMessageDirection.OUTGOING &&
          String(message.sentByUserId || '') === employee.id,
      ).length,
    }));

    const conversationsHandledByEmployee = supportEmployees.map((employee) => ({
      employeeId: employee.id,
      name: employee.name,
      count: conversations.filter(
        (conversation: any) => String(conversation.assignedToUserId || '') === employee.id,
      ).length,
      closed: conversations.filter(
        (conversation: any) => String(conversation.closedByUserId || '') === employee.id,
      ).length,
    }));

    const firstResponseDurations = conversations
      .filter((conversation: any) => conversation.firstResponseAt && conversation.createdAt)
      .map((conversation: any) =>
        new Date(conversation.firstResponseAt).getTime() -
        new Date(conversation.createdAt).getTime(),
      );

    const averageFirstResponseTime = firstResponseDurations.length
      ? Math.round(
          firstResponseDurations.reduce((sum, item) => sum + item, 0) /
            firstResponseDurations.length /
            60000,
        )
      : null;

    const averageResponseTime = this.calculateAverageResponseTime(messages);

    return {
      totalConversations,
      openConversations,
      pendingConversations,
      closedConversations,
      totalMessages,
      messagesByEmployee,
      conversationsHandledByEmployee,
      averageFirstResponseTime,
      averageResponseTime,
      unassignedConversationsCount: conversations.filter(
        (conversation: any) => !conversation.assignedToUserId,
      ).length,
      conversationsClosedByEmployee: conversationsHandledByEmployee,
    };
  }

  /**
   * Returns the conversation for a chat, creating it atomically. Two events for the same
   * new chat (e.g. 'message' + the periodic sync) used to race on findOne → create and
   * the loser threw on the unique index, dropping its message.
   */
  private async findOrCreateConversation(
    companyObjectId: Types.ObjectId,
    whatsappChatId: string,
    defaults: Record<string, unknown>,
  ) {
    const existing = await this.conversationModel.findOne({ companyId: companyObjectId, whatsappChatId });
    if (existing) return { conversation: existing, created: false };
    try {
      const conversation = await this.conversationModel.create({
        companyId: companyObjectId,
        whatsappChatId,
        ...defaults,
      });
      return { conversation, created: true };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const winner = await this.conversationModel.findOne({ companyId: companyObjectId, whatsappChatId });
      if (!winner) throw error;
      return { conversation: winner, created: false };
    }
  }

  /**
   * WhatsApp echoes every message we send (message_create, the in-page watcher, and later
   * the history sync) with its own id. Attach that echo to the agent/AI record that is
   * still waiting for it instead of storing a second "sent from phone" message — this was
   * the source of the duplicated outgoing messages.
   */
  private async claimOutgoingEcho(
    conversationId: Types.ObjectId,
    companyObjectId: Types.ObjectId,
    whatsappMessageId: string,
    body: string,
    sentAt: Date,
  ) {
    const trimmed = (body || '').trim();
    const windowStart = new Date(sentAt.getTime() - ECHO_MATCH_WINDOW_MS);
    const windowEnd = new Date(sentAt.getTime() + ECHO_MATCH_WINDOW_MS);
    const bodyFilter = trimmed
      ? { body: { $regex: `^\\s*${escapeRegex(trimmed)}\\s*$` } }
      : { messageType: { $ne: SupportMessageType.TEXT } };

    const base = {
      companyId: companyObjectId,
      conversationId,
      direction: SupportMessageDirection.OUTGOING,
      providerEchoMatched: { $ne: true },
      createdAt: { $gte: windowStart, $lte: windowEnd },
      $or: [{ sentByUserId: { $ne: null } }, { aiTriggerMessageId: { $type: 'string' } }],
      ...bodyFilter,
    };

    // Prefer the record still without an id (echo beat the send), else one whose id came
    // from the send call in a different format.
    for (const idFilter of [{ whatsappMessageId: null }, { whatsappMessageId: { $ne: whatsappMessageId } }]) {
      try {
        const claimed = await this.messageModel.findOneAndUpdate(
          { ...base, ...idFilter },
          {
            $set: {
              whatsappMessageId,
              providerEchoMatched: true,
            },
          },
          { new: true, sort: { createdAt: 1 } },
        );
        if (claimed) return claimed;
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }

    // Same id already attached by the send call — mark it matched and treat as handled.
    return this.messageModel.findOneAndUpdate(
      { companyId: companyObjectId, whatsappMessageId, sentByUserId: { $ne: null } },
      { $set: { providerEchoMatched: true } },
      { new: true },
    );
  }

  private async handleIncomingMessage(event: IncomingWhatsappMessageEvent) {
    const isEnabled = await this.isSupportEnabled(event.tenantId);
    if (!isEnabled) {
      return;
    }

    const companyObjectId = new Types.ObjectId(event.tenantId);
    const isPhoneOutgoing = event.direction === 'outgoing';

    // An outgoing echo without an id can't be de-duplicated against anything; the
    // periodic sync delivers the same message later with a proper id.
    if (isPhoneOutgoing && !event.whatsappMessageId) {
      return;
    }

    // Webhook-style idempotency: the same WhatsApp message id is processed once, however
    // many times (and through however many paths) it is delivered.
    if (event.whatsappMessageId) {
      const alreadyStored = await this.messageModel.exists({
        companyId: companyObjectId,
        whatsappMessageId: event.whatsappMessageId,
      });
      if (alreadyStored) {
        return;
      }
    }

    const session = await this.whatsappSessionsService.getSession(event.tenantId);
    const whatsappSessionId = this.extractSessionObjectId(session);
    const { conversation, created: createdConversation } = await this.findOrCreateConversation(
      companyObjectId,
      event.whatsappChatId,
      {
        whatsappSessionId,
        customerName: event.customerName || event.customerPhone,
        customerPhone: event.customerPhone,
        profilePicture: event.profilePicture,
        assignedToUserId: null,
        status: SupportConversationStatus.OPEN,
        priority: SupportConversationPriority.NORMAL,
        tagIds: [],
        lastMessage: event.body,
        lastMessageAt: event.createdAt,
        unreadCount: 0,
        firstResponseAt: null,
        lastIncomingMessageAt: isPhoneOutgoing ? null : event.createdAt,
      },
    );

    if (isPhoneOutgoing && event.whatsappMessageId && !createdConversation) {
      const echo = await this.claimOutgoingEcho(
        conversation._id,
        companyObjectId,
        event.whatsappMessageId,
        event.body,
        event.createdAt,
      );
      if (echo) {
        return;
      }
    }

    let incomingMessage: SupportMessageDocument;
    try {
      incomingMessage = await this.messageModel.create({
        companyId: companyObjectId,
        conversationId: conversation._id,
        whatsappSessionId,
        whatsappMessageId: event.whatsappMessageId || null,
        direction: isPhoneOutgoing ? SupportMessageDirection.OUTGOING : SupportMessageDirection.INCOMING,
        messageType: this.normalizeMessageType(event.messageType),
        body: event.body,
        mediaUrl: event.mediaUrl ?? null,
        mediaMimeType: event.mediaMimeType,
        mediaFileName: event.mediaFileName,
        sentByUserId: null,
        sentByUserNameSnapshot: isPhoneOutgoing ? 'الهاتف' : null,
        status: SupportMessageStatus.SENT,
        errorMessage: null,
        providerTimestamp: event.createdAt,
        providerEchoMatched: isPhoneOutgoing,
      });
    } catch (error) {
      // A parallel delivery of the same id got stored first — nothing more to do.
      if (isDuplicateKeyError(error)) return;
      throw error;
    }

    // Atomic counters so concurrent incoming messages don't overwrite each other.
    const update: Record<string, any> = {
      $set: {
        lastMessage: event.body || `[${event.messageType}]`,
        lastMessageAt: event.createdAt,
      },
    };
    if (!isPhoneOutgoing) {
      update.$set.lastIncomingMessageAt = event.createdAt;
      update.$inc = { unreadCount: 1 };
      if (conversation.status === SupportConversationStatus.CLOSED) {
        update.$set.status = SupportConversationStatus.OPEN;
        update.$set.closedAt = null;
        update.$set.closedByUserId = null;
      }
    }
    // Replace an unusable @lid "phone" once the event carries a real number.
    if (!isRealPhone(conversation.customerPhone) && isRealPhone(event.customerPhone)) {
      update.$set.customerPhone = event.customerPhone;
    }
    if (!isPhoneOutgoing && event.customerName && !conversation.customerName) {
      update.$set.customerName = event.customerName;
    }
    const updatedConversation =
      (await this.conversationModel.findByIdAndUpdate(conversation._id, update, { new: true })) ||
      conversation;

    const serializedConversation = await this.serializeConversation(updatedConversation.toObject());
    const serializedMessage = incomingMessage.toObject();
    const audience = this.audienceOf(updatedConversation);

    if (createdConversation) {
      this.supportGateway.emitConversationNew(event.tenantId, audience, {
        conversation: serializedConversation,
        message: serializedMessage,
      });
    } else {
      this.supportGateway.emitConversationUpdated(event.tenantId, audience, {
        conversationId: updatedConversation.id,
        conversation: serializedConversation,
      });
    }

    this.supportGateway.emitMessageNew(event.tenantId, audience, {
      conversationId: updatedConversation.id,
      message: serializedMessage,
    });

    await this.createActivityLog(event.tenantId, {
      action: 'message.received',
      conversationId: updatedConversation.id,
      metadata: {
        whatsappMessageId: event.whatsappMessageId,
      },
    });

    if (!isPhoneOutgoing) {
      void this.maybeAutoReply(event.tenantId, updatedConversation.id, incomingMessage).catch((error) =>
        this.logger.error(
          `AI auto-reply crashed for conversation ${updatedConversation.id}: ${error instanceof Error ? error.stack || error.message : error}`,
        ),
      );
    }
  }

  private async handleMessageEdit(event: WhatsappMessageEditEvent) {
    const isEnabled = await this.isSupportEnabled(event.tenantId);
    if (!isEnabled) return;

    const companyObjectId = new Types.ObjectId(event.tenantId);
    const message = await this.messageModel.findOne({
      companyId: companyObjectId,
      whatsappMessageId: event.whatsappMessageId,
    });
    if (!message) {
      this.logger.warn(
        `Edit received for unknown message ${event.whatsappMessageId} (tenant ${event.tenantId}); it will be picked up by the next sync`,
      );
      return;
    }

    await this.applyMessageEdit(message, event.newBody, event.editedAt);
  }

  /** Updates a stored message's text in place (never creates a new message). */
  private async applyMessageEdit(message: SupportMessageDocument, newBody: string, editedAt: Date) {
    const next = newBody ?? '';
    if (message.body === next) return null;

    message.originalBody = message.originalBody ?? message.body;
    message.body = next;
    message.isEdited = true;
    message.editedAt = editedAt;
    await message.save();

    const conversation = await this.conversationModel.findById(message.conversationId);
    if (!conversation) return message.toObject();

    // Keep the list preview in step when the edited message is the latest one.
    const latest = await this.messageModel
      .findOne({ conversationId: conversation._id }, { _id: 1 })
      .sort({ createdAt: -1 })
      .lean();
    if (latest && String(latest._id) === String(message._id)) {
      conversation.lastMessage = next;
      await conversation.save();
    }

    const companyId = String(conversation.companyId);
    const audience = this.audienceOf(conversation);
    this.supportGateway.emitMessageUpdated(companyId, audience, {
      conversationId: conversation.id,
      message: message.toObject(),
    });
    this.supportGateway.emitConversationUpdated(companyId, audience, {
      conversationId: conversation.id,
      conversation: await this.serializeConversation(conversation.toObject()),
    });
    this.logger.log(`Message ${message.whatsappMessageId} edited in conversation ${conversation.id}`);
    return message.toObject();
  }

  private async syncSingleWhatsappChat(
    companyId: string,
    whatsappSessionId: Types.ObjectId | null,
    chat: WhatsappChatHistorySnapshot,
  ) {
    const companyObjectId = new Types.ObjectId(companyId);
    const lastIncomingAt =
      [...chat.messages].reverse().find((item) => item.direction === 'incoming')?.createdAt || null;

    const { conversation, created: importedConversation } = await this.findOrCreateConversation(
      companyObjectId,
      chat.whatsappChatId,
      {
        whatsappSessionId,
        customerName: chat.customerName || chat.customerPhone,
        customerPhone: chat.customerPhone,
        profilePicture: null,
        assignedToUserId: null,
        status: SupportConversationStatus.OPEN,
        priority: SupportConversationPriority.NORMAL,
        tagIds: [],
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        unreadCount: chat.unreadCount,
        firstResponseAt: null,
        lastIncomingMessageAt: lastIncomingAt,
      },
    );

    if (!importedConversation) {
      conversation.whatsappSessionId = whatsappSessionId;
      conversation.customerName = chat.customerName || conversation.customerName;
      if (isRealPhone(chat.customerPhone) || !isRealPhone(conversation.customerPhone)) {
        conversation.customerPhone = chat.customerPhone || conversation.customerPhone;
      }
      conversation.lastMessage = chat.lastMessage || conversation.lastMessage;
      conversation.lastMessageAt = chat.lastMessageAt || conversation.lastMessageAt;
      conversation.unreadCount = Math.max(conversation.unreadCount || 0, chat.unreadCount || 0);
      conversation.lastIncomingMessageAt = lastIncomingAt || conversation.lastIncomingMessageAt;
      await conversation.save();
    }

    // Defensive: a non-string id here (WhatsApp Web has handed us raw id objects)
    // makes Mongo throw a CastError that aborts the entire sync, so nothing gets
    // stored at all. Normalise to strings and drop anything unusable.
    for (const message of chat.messages) {
      const id = message.whatsappMessageId as unknown;
      if (id != null && typeof id !== 'string') {
        const obj = id as Record<string, unknown>;
        const rebuilt =
          (obj._serialized as string) ||
          (obj.$1 as string) ||
          (obj.id ? `${!!obj.fromMe}_${String(obj.remote)}_${String(obj.id)}` : null);
        message.whatsappMessageId = rebuilt ?? null;
      }
    }

    const candidateIds = chat.messages
      .map((message) => message.whatsappMessageId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const existingDocs = await this.messageModel.find({
      companyId: companyObjectId,
      whatsappMessageId: { $in: candidateIds },
    });
    const existingById = new Map(existingDocs.map((doc) => [String(doc.whatsappMessageId), doc]));

    // Edit resync for chats whose edit event we missed: same id, different text.
    const updatedDocs: any[] = [];
    for (const message of chat.messages) {
      const existing = message.whatsappMessageId ? existingById.get(message.whatsappMessageId) : null;
      if (
        existing &&
        existing.direction === SupportMessageDirection.INCOMING &&
        message.body &&
        existing.body !== message.body
      ) {
        const updated = await this.applyMessageEdit(existing, message.body, new Date());
        if (updated) updatedDocs.push(updated);
      }
    }

    const newMessages: typeof chat.messages = [];
    for (const message of chat.messages) {
      if (message.whatsappMessageId && existingById.has(message.whatsappMessageId)) continue;
      if (message.direction === 'outgoing' && message.whatsappMessageId && !importedConversation) {
        const echo = await this.claimOutgoingEcho(
          conversation._id,
          companyObjectId,
          message.whatsappMessageId,
          message.body,
          message.createdAt,
        );
        if (echo) continue;
      }
      newMessages.push(message);
    }

    let insertedDocs: any[] = [];
    if (newMessages.length) {
      try {
        insertedDocs = await this.messageModel.insertMany(
          newMessages.map((message, index) => ({
            companyId: companyObjectId,
            conversationId: conversation._id,
            whatsappSessionId,
            whatsappMessageId:
              message.whatsappMessageId ||
              `history:${chat.whatsappChatId}:${message.createdAt.getTime()}:${index}`,
            direction:
              message.direction === 'outgoing'
                ? SupportMessageDirection.OUTGOING
                : SupportMessageDirection.INCOMING,
            messageType: this.normalizeMessageType(message.messageType),
            body: message.body || '',
            mediaUrl: null,
            mediaMimeType: message.mediaMimeType,
            mediaFileName: message.mediaFileName,
            sentByUserId: null,
            sentByUserNameSnapshot: message.direction === 'outgoing' ? 'الهاتف' : null,
            status:
              message.direction === 'outgoing'
                ? SupportMessageStatus.SENT
                : SupportMessageStatus.READ,
            errorMessage: null,
            providerTimestamp: message.createdAt,
            providerEchoMatched: message.direction === 'outgoing',
            createdAt: message.createdAt,
            updatedAt: message.createdAt,
          })),
          { ordered: false },
        );
      } catch (error: any) {
        // ordered:false still inserts the non-duplicates; a realtime event may have
        // stored some of these ids between our lookup and this insert.
        if (!isDuplicateKeyError(error) && !(error?.writeErrors || []).every((e: any) => e?.code === 11000)) {
          throw error;
        }
        insertedDocs = error?.insertedDocs || [];
      }
    }

    return {
      importedConversation,
      importedMessages: insertedDocs.length,
      insertedDocs,
      updatedDocs,
      conversationId: String(conversation._id),
    };
  }

  private async handleMessageAck(event: WhatsappMessageAckEvent) {
    const isEnabled = await this.isSupportEnabled(event.tenantId);
    if (!isEnabled) {
      return;
    }

    const message = await this.messageModel.findOne({
      companyId: new Types.ObjectId(event.tenantId),
      whatsappMessageId: event.whatsappMessageId,
    });

    if (!message) {
      return;
    }

    const nextStatus = this.mapAckToMessageStatus(event.ack);
    if (message.status === nextStatus) {
      return;
    }

    message.status = nextStatus;
    await message.save();

    const conversation = await this.conversationModel.findById(message.conversationId);
    if (!conversation) return;
    this.supportGateway.emitMessageStatusUpdated(event.tenantId, this.audienceOf(conversation), {
      conversationId: String(message.conversationId),
      messageId: message.id,
      status: nextStatus,
      ack: event.ack,
    });
  }

  private async handleSessionUpdate(event: WhatsappSessionUpdateEvent) {
    const isEnabled = await this.isSupportEnabled(event.tenantId);
    if (!isEnabled) {
      return;
    }

    if (event.session.status === 'qr_ready') {
      this.supportGateway.emitWhatsappQr(event.tenantId, event.session);
      return;
    }

    if (event.session.status === 'ready') {
      this.supportGateway.emitWhatsappConnected(event.tenantId, event.session);

      // Initial sync on connect
      this._internalSyncWhatsappHistory(event.tenantId)
        .then(() => this.logger.log(`Auto-synced WhatsApp history for tenant ${event.tenantId}`))
        .catch((err) => this.logger.error(`Failed to auto-sync for tenant ${event.tenantId}`, err));

      // Periodic reconciliation every 30s — a light backup for the real-time events
      // (kept infrequent so it doesn't hammer Chrome / the event loop).
      if (!this.syncTimers.has(event.tenantId)) {
        const timer = setInterval(() => {
          this._periodicSync(event.tenantId).catch((err) =>
            this.logger.warn(
              `Periodic sync failed for tenant ${event.tenantId}: ${err instanceof Error ? err.message : err}`,
            ),
          );
        }, PERIODIC_SYNC_INTERVAL_MS);
        this.syncTimers.set(event.tenantId, timer);
      }

      return;
    }

    if (['disconnected', 'auth_failure'].includes(event.session.status)) {
      const timer = this.syncTimers.get(event.tenantId);
      if (timer) { clearInterval(timer); this.syncTimers.delete(event.tenantId); }
      this.supportGateway.emitWhatsappDisconnected(event.tenantId, event.session);
    }
  }

  // ─── AI auto-reply ─────────────────────────────────────────────────────────

  /** Staff replying to / taking a conversation stops AI there, if the company wants that. */
  private async applyHumanTakeover(conversation: SupportConversationDocument) {
    if (conversation.aiStatus === SupportAiStatus.PAUSED) return;
    const settings = await this.getSupportSettings(String(conversation.companyId));
    if (settings.aiEnabled && settings.aiPauseOnHumanTakeover) {
      conversation.aiStatus = SupportAiStatus.HUMAN_TAKEOVER;
      conversation.aiUpdatedAt = new Date();
    }
  }

  private async setAiStatus(
    conversationId: string,
    status: SupportAiStatus,
    error: string | null = null,
  ) {
    const conversation = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $set: { aiStatus: status, aiLastError: error, aiUpdatedAt: new Date() } },
      { new: true },
    );
    if (conversation) {
      this.supportGateway.emitConversationUpdated(String(conversation.companyId), this.audienceOf(conversation), {
        conversationId,
        conversation: await this.serializeConversation(conversation.toObject()),
      });
    }
    return conversation;
  }

  /**
   * One AI pass for one incoming message. Every early exit is logged with its reason so
   * "AI does nothing" is diagnosable from the logs instead of failing silently.
   */
  private async maybeAutoReply(
    companyId: string,
    conversationId: string,
    trigger: SupportMessageDocument,
  ) {
    const settings = await this.getSupportSettings(companyId);
    if (!settings.aiEnabled) return;

    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) return;

    if (conversation.aiStatus === SupportAiStatus.PAUSED) {
      this.logger.log(`AI skipped for ${conversationId}: paused for this conversation`);
      return;
    }
    if (conversation.aiStatus === SupportAiStatus.HUMAN_TAKEOVER && settings.aiPauseOnHumanTakeover) {
      this.logger.log(`AI skipped for ${conversationId}: human takeover`);
      return;
    }
    if (conversation.assignedToUserId && settings.aiPauseOnHumanTakeover) {
      await this.setAiStatus(conversationId, SupportAiStatus.HUMAN_TAKEOVER);
      this.logger.log(`AI skipped for ${conversationId}: assigned to a staff member`);
      return;
    }
    if (!this.supportAiService.isConfigured()) {
      await this.setAiStatus(conversationId, SupportAiStatus.FAILED, 'ANTHROPIC_API_KEY غير مضبوط على السيرفر');
      this.logger.error(`AI enabled for tenant ${companyId} but ANTHROPIC_API_KEY is not set`);
      return;
    }
    if (!trigger.whatsappMessageId) {
      this.logger.warn(`AI skipped for ${conversationId}: trigger message has no WhatsApp id`);
      return;
    }
    if (this.aiInFlight.has(conversationId)) {
      // The in-flight reply already sees this message in its history.
      this.logger.log(`AI skipped for ${conversationId}: a reply is already being generated`);
      return;
    }

    this.aiInFlight.add(conversationId);
    try {
      await this.setAiStatus(conversationId, SupportAiStatus.PROCESSING);
      const tenant = await this.tenantsService.findById(companyId);
      const history = await this.supportAiService.loadHistory(conversation.companyId, conversation._id);

      const decision = await this.supportAiService.generateReply({
        companyName: tenant.name,
        instructions: settings.aiInstructions,
        knowledgeBase: settings.aiKnowledgeBase,
        history,
      });

      if (decision.action === 'handoff') {
        await this.setAiStatus(conversationId, SupportAiStatus.HUMAN_TAKEOVER);
        await this.createActivityLog(companyId, {
          action: 'ai.handoff',
          conversationId,
          metadata: { reason: decision.reason, triggerMessageId: trigger.whatsappMessageId },
        });
        const note = await this.noteModel.create({
          companyId: conversation.companyId,
          conversationId: conversation._id,
          userId: conversation.assignedToUserId || (await this.firstCompanyAdminId(companyId)),
          note: `🤖 الذكاء الاصطناعي حوّل المحادثة لموظف: ${decision.reason}`,
        });
        this.supportGateway.emitNoteNew(companyId, this.audienceOf(conversation), {
          conversationId,
          note: await this.serializeNote(note.toObject(), companyId),
        });
        return;
      }

      await this.sendAiReply(conversation, trigger, decision.message);
      await this.setAiStatus(conversationId, SupportAiStatus.ACTIVE);
    } catch (error) {
      const reason = error instanceof SupportAiError || error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`AI reply failed for conversation ${conversationId}: ${reason}`);
      await this.setAiStatus(conversationId, SupportAiStatus.FAILED, reason);
      await this.createActivityLog(companyId, {
        action: 'ai.failed',
        conversationId,
        metadata: { error: reason, triggerMessageId: trigger.whatsappMessageId },
      });
    } finally {
      this.aiInFlight.delete(conversationId);
    }
  }

  private async sendAiReply(
    conversation: SupportConversationDocument,
    trigger: SupportMessageDocument,
    text: string,
  ) {
    const companyId = String(conversation.companyId);
    let pending: SupportMessageDocument;
    try {
      // Unique (companyId, aiTriggerMessageId): a re-processed trigger can never produce a
      // second reply — the insert fails before anything is sent.
      pending = await this.messageModel.create({
        companyId: conversation.companyId,
        conversationId: conversation._id,
        whatsappSessionId: conversation.whatsappSessionId,
        whatsappMessageId: null,
        aiTriggerMessageId: trigger.whatsappMessageId,
        direction: SupportMessageDirection.OUTGOING,
        messageType: SupportMessageType.TEXT,
        body: text,
        sentByUserId: null,
        sentByUserNameSnapshot: 'المساعد الذكي',
        status: SupportMessageStatus.PENDING,
        providerTimestamp: new Date(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        this.logger.warn(`AI reply for trigger ${trigger.whatsappMessageId} already exists; not sending again`);
        return;
      }
      throw error;
    }

    try {
      const result = await this.whatsappSessionsService.sendTextMessage(
        companyId,
        conversation.whatsappChatId,
        text,
      );
      const confirmed = await this.confirmOutgoingSend(pending, result.providerMessageId);
      const updated = await this.conversationModel.findByIdAndUpdate(
        conversation._id,
        { $set: { lastMessage: text, lastMessageAt: new Date() } },
        { new: true },
      );
      const audience = this.audienceOf(updated || conversation);
      this.supportGateway.emitMessageNew(companyId, audience, {
        conversationId: conversation.id,
        message: confirmed,
      });
      await this.createActivityLog(companyId, {
        action: 'ai.replied',
        conversationId: conversation.id,
        metadata: { triggerMessageId: trigger.whatsappMessageId },
      });
    } catch (error) {
      await this.messageModel.updateOne(
        { _id: pending._id },
        { $set: { status: SupportMessageStatus.FAILED, errorMessage: error instanceof Error ? error.message : 'send failed' } },
      );
      const failed = await this.messageModel.findById(pending._id).lean();
      this.supportGateway.emitMessageNew(companyId, this.audienceOf(conversation), {
        conversationId: conversation.id,
        message: failed,
      });
      throw error;
    }
  }

  private async firstCompanyAdminId(companyId: string) {
    const admin = await this.usersService.findPrimaryTenantAdmin(companyId);
    if (admin?.id) return new Types.ObjectId(admin.id);
    const anyone = (await this.usersService.listAllForTenant(companyId))[0];
    return anyone?.id ? new Types.ObjectId(anyone.id) : new Types.ObjectId();
  }

  private audienceOf(
    conversation: { assignedToUserId?: Types.ObjectId | string | null },
    previousAssignedToUserId?: string | null,
  ): ConversationAudience {
    return {
      assignedToUserId: conversation.assignedToUserId ? String(conversation.assignedToUserId) : null,
      previousAssignedToUserId: previousAssignedToUserId || null,
    };
  }

  private async buildOutgoingMessage(
    companyId: string,
    dto: SendSupportMessageDto,
    conversation: SupportConversationDocument,
  ) {
    if (dto.quickReplyId) {
      const quickReply = await this.quickReplyModel.findOne({
        _id: new Types.ObjectId(dto.quickReplyId),
        companyId: new Types.ObjectId(companyId),
        isActive: true,
      });

      if (!quickReply) {
        throw new NotFoundException('Quick reply not found');
      }

      return dto.body?.trim()
        ? `${quickReply.message}\n${dto.body.trim()}`
        : quickReply.message;
    }

    return dto.body || conversation.lastMessage || '';
  }

  private async getScopedConversation(
    user: SupportUserContext,
    conversationId: string,
  ) {
    const companyId = await this.resolveCompanyId(user);
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      companyId: new Types.ObjectId(companyId),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.assertConversationAccess(user, conversation);
    return conversation;
  }

  /**
   * Builds the list query. Visibility and search are separate $and clauses: previously
   * both wrote `filter.$or`, so for agents the visibility rule silently replaced the
   * search, and for restricted supervisors the search was OR-ed with "assigned to me"
   * (leaking every matching conversation).
   */
  private async buildConversationFilter(
    user: SupportUserContext,
    companyId: string,
    query: ListConversationsDto,
  ) {
    const and: Record<string, unknown>[] = [{ companyId: new Types.ObjectId(companyId) }];

    if (query.status) {
      and.push({ status: query.status });
    }

    const search = query.search?.trim();
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      const digits = search.replace(/\D/g, '');
      and.push({
        $or: [
          { customName: pattern },
          { customerName: pattern },
          { customerPhone: digits.length >= 3 ? { $regex: escapeRegex(digits) } : pattern },
        ],
      });
    }

    if (query.filter === 'assigned_to_me') {
      and.push({ assignedToUserId: new Types.ObjectId(user.id) });
    } else if (query.filter === 'unassigned') {
      and.push({ assignedToUserId: null });
    }

    const visibility = await this.visibilityClause(user, companyId);
    if (visibility) {
      if (query.filter === 'unassigned' && user.role === UserRole.AGENT) {
        const settings = await this.getSupportSettings(companyId);
        if (!settings.allowAgentViewUnassigned) {
          throw new ForbiddenException('Agents cannot view unassigned conversations');
        }
      }
      and.push(visibility);
    }

    return { $and: and };
  }

  /**
   * Which conversations a user may see at all, enforced in the query itself. Agents: their
   * own + unassigned (if allowed). Restricted supervisors: their own + unassigned. Admins
   * and supervisors with "view all": everything. Returns null for "no restriction".
   */
  private async visibilityClause(user: SupportUserContext, companyId: string) {
    if ([UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN].includes(user.role)) {
      return null;
    }
    const settings = await this.getSupportSettings(companyId);
    if (user.role === UserRole.SUPERVISOR && settings.allowSupervisorViewAll) {
      return null;
    }

    const clauses: Record<string, unknown>[] = [{ assignedToUserId: new Types.ObjectId(user.id) }];
    if (user.role === UserRole.SUPERVISOR || settings.allowAgentViewUnassigned) {
      clauses.push({ assignedToUserId: null });
    }
    return { $or: clauses };
  }

  private async assertConversationAccess(
    user: SupportUserContext,
    conversation: SupportConversationDocument,
  ) {
    const visibility = await this.visibilityClause(user, String(conversation.companyId));
    if (!visibility) {
      return;
    }

    const assignee = conversation.assignedToUserId ? String(conversation.assignedToUserId) : null;
    if (assignee === user.id) {
      return;
    }
    const allowsUnassigned = (visibility.$or as Record<string, unknown>[]).some(
      (clause) => clause.assignedToUserId === null,
    );
    if (!assignee && allowsUnassigned) {
      return;
    }

    // Assigned to someone else: the same rule the list applies, now also on direct access
    // (previously any agent could open, read and reply to any conversation by id).
    throw new ForbiddenException('هذه المحادثة معيّنة لموظف آخر');
  }

  async agentStats(
    user: SupportUserContext,
    from?: string,
    to?: string,
    companyId?: string,
  ) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, SupportPermission.REPORTS_VIEW);
    const { fromDate, toDate } = this.resolveDateRange(from, to);
    const companyObjectId = new Types.ObjectId(effectiveCompanyId);
    const dayCount = Math.max(
      1,
      Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000),
    );

    const employees = await this.usersService.listAllForTenant(effectiveCompanyId);
    const supportEmployees = employees.filter((e) =>
      [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT].includes(e.role),
    );

    const employeeIds = supportEmployees.map((e) => new Types.ObjectId(e.id));

    const [sessions, messages, conversations] = await Promise.all([
      this.agentSessionModel
        .find({
          tenantId: companyObjectId,
          userId: { $in: employeeIds },
          loginAt: { $gte: fromDate, $lte: toDate },
          durationMinutes: { $ne: null },
        })
        .lean(),
      this.messageModel
        .find({
          companyId: companyObjectId,
          createdAt: { $gte: fromDate, $lte: toDate },
          sentByUserId: { $in: employeeIds },
        })
        .lean(),
      this.conversationModel
        .find({
          companyId: companyObjectId,
          createdAt: { $gte: fromDate, $lte: toDate },
        })
        .lean(),
    ]);

    return supportEmployees.map((employee) => {
      const empId = employee.id;
      const empSessions = sessions.filter((s) => String(s.userId) === empId);
      const totalMinutes = empSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      const avgHoursPerDay = totalMinutes / dayCount / 60;
      const empMessages = messages.filter((m) => String(m.sentByUserId || '') === empId);
      const empHandled = (conversations as any[]).filter(
        (c) => String(c.assignedToUserId || '') === empId,
      );
      const empClosed = (conversations as any[]).filter(
        (c) => String(c.closedByUserId || '') === empId,
      );

      return {
        employeeId: empId,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        totalSessions: empSessions.length,
        totalOnlineMinutes: totalMinutes,
        avgOnlineHoursPerDay: Math.round(avgHoursPerDay * 10) / 10,
        messagesSent: empMessages.length,
        conversationsHandled: empHandled.length,
        conversationsClosed: empClosed.length,
      };
    });
  }

  private async resolveCompanyId(user: SupportUserContext, explicitCompanyId?: string) {
    const companyId = user.role === UserRole.SUPER_ADMIN ? explicitCompanyId : user.tenantId;

    if (!companyId) {
      throw new ForbiddenException('Company ID is required');
    }

    const enabled = await this.isSupportEnabled(companyId);
    if (!enabled) {
      throw new ForbiddenException('Support Inbox is not enabled for this company');
    }

    return companyId;
  }

  private async isSupportEnabled(companyId: string) {
    const tenant = await this.tenantsService.findById(companyId);
    return (tenant.enabledProducts || []).includes(TenantProduct.SUPPORT);
  }

  private assertHasPermission(
    user: SupportUserContext,
    permission: (typeof SupportPermission)[keyof typeof SupportPermission],
  ) {
    if (!hasSupportPermission(user, permission)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
  }

  private async getSupportSettings(companyId: string): Promise<SupportSettings> {
    const tenant = await this.tenantsService.findById(companyId);
    return this.mergeSupportSettings(tenant.settings);
  }

  private mergeSupportSettings(settings: Record<string, unknown> | undefined) {
    const supportSettings = ((settings?.['support'] as Partial<SupportSettings>) ||
      {}) as Partial<SupportSettings>;
    return {
      ...DEFAULT_SUPPORT_SETTINGS,
      ...supportSettings,
    };
  }

  private async createActivityLog(
    companyId: string,
    input: {
      userId?: string;
      action: string;
      conversationId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.activityLogModel.create({
      companyId: new Types.ObjectId(companyId),
      userId: input.userId ? new Types.ObjectId(input.userId) : null,
      action: input.action,
      conversationId: input.conversationId
        ? new Types.ObjectId(input.conversationId)
        : null,
      metadata: input.metadata || {},
    });
  }

  private async hydrateConversations(conversations: any[]) {
    if (!conversations.length) {
      return [];
    }

    const companyId = String(conversations[0].companyId);
    const employees = await this.usersService.listAllForTenant(companyId);
    const tags = await this.tagModel
      .find({ companyId: new Types.ObjectId(companyId) })
      .lean();

    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const tagMap = new Map(tags.map((tag: any) => [String(tag._id), tag]));
    const settings = await this.getSupportSettings(companyId);

    return conversations.map((conversation: any) => ({
      ...conversation,
      // One name for every screen: staff-set name first, then the WhatsApp name.
      displayName: conversation.customName || conversation.customerName || null,
      // null when WhatsApp only gave us an internal @lid id — the UI then says so.
      phoneNumber: isRealPhone(conversation.customerPhone)
        ? String(conversation.customerPhone).replace(/\D/g, '')
        : null,
      aiState: !settings.aiEnabled
        ? 'disabled'
        : conversation.aiStatus || SupportAiStatus.ACTIVE,
      assignedTo: conversation.assignedToUserId
        ? employeeMap.get(String(conversation.assignedToUserId)) || null
        : null,
      tags: (conversation.tagIds || [])
        .map((tagId: Types.ObjectId | string) => tagMap.get(String(tagId)) || null)
        .filter(Boolean),
    }));
  }

  private async serializeConversation(conversation: any) {
    const [item] = await this.hydrateConversations([conversation]);
    return item;
  }

  private normalizeMessageType(messageType: string) {
    switch (messageType) {
      case SupportMessageType.IMAGE:
      case SupportMessageType.AUDIO:
      case SupportMessageType.VIDEO:
      case SupportMessageType.DOCUMENT:
      case SupportMessageType.STICKER:
      case SupportMessageType.LOCATION:
        return messageType;
      default:
        return SupportMessageType.TEXT;
    }
  }

  private mapAckToMessageStatus(ack: number) {
    if (ack >= 3) {
      return SupportMessageStatus.READ;
    }
    if (ack === 2) {
      return SupportMessageStatus.DELIVERED;
    }
    if (ack === 1) {
      return SupportMessageStatus.SENT;
    }
    if (ack < 0) {
      return SupportMessageStatus.FAILED;
    }
    return SupportMessageStatus.PENDING;
  }

  private resolveDateRange(from?: string, to?: string) {
    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date(0);
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    return { fromDate, toDate };
  }

  private calculateAverageResponseTime(messages: any[]) {
    const grouped = new Map<string, any[]>();
    for (const message of messages) {
      const key = String(message.conversationId);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(message);
    }

    const responseDurations: number[] = [];
    grouped.forEach((conversationMessages) => {
      const sorted = [...conversationMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      for (let index = 0; index < sorted.length - 1; index += 1) {
        const current = sorted[index];
        const next = sorted[index + 1];
        if (
          current.direction === SupportMessageDirection.INCOMING &&
          next.direction === SupportMessageDirection.OUTGOING
        ) {
          responseDurations.push(
            new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime(),
          );
        }
      }
    });

    return responseDurations.length
      ? Math.round(
          responseDurations.reduce((sum, item) => sum + item, 0) /
            responseDurations.length /
            60000,
        )
      : null;
  }

  private extractSessionObjectId(session: Record<string, unknown>) {
    const rawId = session && '_id' in session ? String(session._id) : null;
    return rawId ? new Types.ObjectId(rawId) : null;
  }

  private async hydrateNotes(notes: any[], companyId: string) {
    if (!notes.length) {
      return [];
    }

    const employees = await this.usersService.listAllForTenant(companyId);
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

    return notes.map((note) => ({
      ...note,
      author: employeeMap.get(String(note.userId)) || null,
    }));
  }

  private async serializeNote(note: any, companyId: string) {
    const [item] = await this.hydrateNotes([note], companyId);
    return item;
  }
}
