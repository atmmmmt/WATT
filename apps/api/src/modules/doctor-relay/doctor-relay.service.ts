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
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DoctorRelayPermission,
  hasDoctorRelayPermission,
} from '../../common/utils/doctor-relay-permissions.util';
import { TenantsService } from '../tenants/tenants.service';
import { TenantProduct } from '../tenants/schemas/tenant.schema';
import { UserRole } from '../users/schemas/user.schema';
import {
  IncomingWhatsappMessageEvent,
  WhatsappSessionsService,
} from '../whatsapp-sessions/whatsapp-sessions.service';
import { CreateDoctorRelayDoctorDto } from './dto/create-doctor-relay-doctor.dto';
import { CreateDoctorRelayLinkDto } from './dto/create-doctor-relay-link.dto';
import { CreateDoctorRelayPatientDto } from './dto/create-doctor-relay-patient.dto';
import { LinkConversationsDto } from './dto/link-conversations.dto';
import { UpdateDoctorRelaySettingsDto } from './dto/update-doctor-relay-settings.dto';
import {
  DoctorRelayLink,
  DoctorRelayLinkDocument,
  DoctorRelayLinkStatus,
} from './schemas/doctor-relay-link.schema';
import {
  DoctorRelayMessage,
  DoctorRelayMessageDirection,
  DoctorRelayMessageDocument,
  DoctorRelayMessageStatus,
} from './schemas/doctor-relay-message.schema';
import {
  DoctorRelayDoctor,
  DoctorRelayDoctorDocument,
  DoctorRelayPersonStatus,
} from './schemas/doctor-relay-doctor.schema';
import {
  DoctorRelayPatient,
  DoctorRelayPatientDocument,
} from './schemas/doctor-relay-patient.schema';
import { DoctorRelayGateway } from './doctor-relay.gateway';

export interface DoctorRelayUserContext {
  id: string;
  role: UserRole;
  tenantId: string | null;
  name: string;
  permissions?: string[];
}

interface DoctorRelaySettings {
  professionalLabel: string;
  clientLabel: string;
}

const DEFAULT_DOCTOR_RELAY_SETTINGS: DoctorRelaySettings = {
  professionalLabel: 'الطبيب',
  clientLabel: 'المريض',
};

@Injectable()
export class DoctorRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DoctorRelayService.name);
  private offIncomingMessage?: () => void;

  constructor(
    @InjectModel(DoctorRelayLink.name)
    private readonly linkModel: Model<DoctorRelayLinkDocument>,
    @InjectModel(DoctorRelayMessage.name)
    private readonly messageModel: Model<DoctorRelayMessageDocument>,
    @InjectModel(DoctorRelayDoctor.name)
    private readonly doctorModel: Model<DoctorRelayDoctorDocument>,
    @InjectModel(DoctorRelayPatient.name)
    private readonly patientModel: Model<DoctorRelayPatientDocument>,
    private readonly tenantsService: TenantsService,
    private readonly whatsappSessionsService: WhatsappSessionsService,
    private readonly gateway: DoctorRelayGateway,
  ) {}

  onModuleInit() {
    this.offIncomingMessage = this.whatsappSessionsService.onIncomingMessage((event) =>
      this.handleIncomingMessage(event),
    );
  }

  onModuleDestroy() {
    this.offIncomingMessage?.();
  }

  async getSettings(user: DoctorRelayUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    return this.getDoctorRelaySettings(effectiveCompanyId);
  }

  async updateSettings(
    user: DoctorRelayUserContext,
    dto: UpdateDoctorRelaySettingsDto,
    companyId?: string,
  ) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_MANAGE);
    const tenant = await this.tenantsService.findById(effectiveCompanyId);
    const settings = this.mergeDoctorRelaySettings(tenant.settings);
    const nextSettings = { ...settings, ...dto };

    await this.tenantsService.updateSettings(effectiveCompanyId, {
      ...(tenant.settings || {}),
      doctorRelay: nextSettings,
    });

    return nextSettings;
  }

  async createDoctor(user: DoctorRelayUserContext, dto: CreateDoctorRelayDoctorDto) {
    const companyId = await this.resolveCompanyId(user, dto.companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_CREATE);

    // The "new link" form always creates both parties first. Rejecting a known phone made
    // the second link for the same doctor fail half-way, so reuse the directory record.
    const existing = await this.doctorModel.findOne({
      tenantId: new Types.ObjectId(companyId),
      phone: dto.phone,
    });
    if (existing) {
      if (dto.name && existing.name !== dto.name) {
        existing.name = dto.name;
        await existing.save();
      }
      return existing.toObject();
    }

    const doctor = await this.doctorModel.create({
      tenantId: new Types.ObjectId(companyId),
      name: dto.name,
      phone: dto.phone,
      specialty: dto.specialty || '',
      status: DoctorRelayPersonStatus.ACTIVE,
    });
    return doctor.toObject();
  }

  async listDoctors(user: DoctorRelayUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_VIEW);
    return this.doctorModel
      .find({ tenantId: new Types.ObjectId(effectiveCompanyId) })
      .sort({ name: 1 })
      .lean();
  }

  async createPatient(user: DoctorRelayUserContext, dto: CreateDoctorRelayPatientDto) {
    const companyId = await this.resolveCompanyId(user, dto.companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_CREATE);

    const existing = await this.patientModel.findOne({
      tenantId: new Types.ObjectId(companyId),
      phone: dto.phone,
    });
    if (existing) {
      if (dto.name && existing.name !== dto.name) {
        existing.name = dto.name;
        await existing.save();
      }
      return existing.toObject();
    }

    const patient = await this.patientModel.create({
      tenantId: new Types.ObjectId(companyId),
      name: dto.name,
      phone: dto.phone,
      notes: dto.notes || '',
      status: DoctorRelayPersonStatus.ACTIVE,
    });
    return patient.toObject();
  }

  async listPatients(user: DoctorRelayUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_VIEW);
    return this.patientModel
      .find({ tenantId: new Types.ObjectId(effectiveCompanyId) })
      .sort({ name: 1 })
      .lean();
  }

  async createLink(user: DoctorRelayUserContext, dto: CreateDoctorRelayLinkDto) {
    const companyId = await this.resolveCompanyId(user, dto.companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_CREATE);

    const tenantObjectId = new Types.ObjectId(companyId);

    const doctor = await this.doctorModel.findOne({
      _id: new Types.ObjectId(dto.doctorId),
      tenantId: tenantObjectId,
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const patient = await this.patientModel.findOne({
      _id: new Types.ObjectId(dto.patientId),
      tenantId: tenantObjectId,
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const doctorChatId = await this.whatsappSessionsService.resolveChatId(
      companyId,
      doctor.phone,
    );
    const patientChatId = await this.whatsappSessionsService.resolveChatId(
      companyId,
      patient.phone,
    );

    const existing = await this.linkModel.findOne({
      tenantId: tenantObjectId,
      patientChatId,
      status: DoctorRelayLinkStatus.ACTIVE,
    });
    if (existing) {
      throw new BadRequestException('This patient already has an active doctor link');
    }

    const link = await this.linkModel.create({
      tenantId: tenantObjectId,
      doctorPhone: doctor.phone,
      doctorName: doctor.name,
      doctorChatId,
      patientPhone: patient.phone,
      patientName: patient.name,
      patientChatId,
      patientLabel: dto.patientLabel || this.generatePatientLabel(),
      status: DoctorRelayLinkStatus.ACTIVE,
      createdByUserId: new Types.ObjectId(user.id),
    });

    this.gateway.emitLinkNew(companyId, { link: link.toObject() });
    return link.toObject();
  }

  // Create a link directly from two existing support conversations. Uses the
  // conversation's own whatsappChatId (already known) so we never need a live
  // WhatsApp round-trip — which is what caused the "Internal server error".
  // Also upserts the doctor/patient directory records by phone (updating names).
  async linkFromConversations(user: DoctorRelayUserContext, dto: LinkConversationsDto) {
    const companyId = await this.resolveCompanyId(user, dto.companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_CREATE);
    const tenantObjectId = new Types.ObjectId(companyId);

    const professionalChatId = this.resolveChatIdLenient(dto.professional.chatId, dto.professional.phone);
    const clientChatId = this.resolveChatIdLenient(dto.client.chatId, dto.client.phone);

    if (!professionalChatId || !clientChatId) {
      throw new BadRequestException('تعذر تحديد معرّف واتساب لأحد الطرفين');
    }
    if (professionalChatId === clientChatId) {
      throw new BadRequestException('لا يمكن ربط المحادثة بنفسها');
    }

    await this.upsertPersonByPhone(this.doctorModel, tenantObjectId, dto.professional.name, dto.professional.phone);
    await this.upsertPersonByPhone(this.patientModel, tenantObjectId, dto.client.name, dto.client.phone);

    const existing = await this.linkModel.findOne({
      tenantId: tenantObjectId,
      patientChatId: clientChatId,
      status: DoctorRelayLinkStatus.ACTIVE,
    });
    if (existing) {
      throw new BadRequestException('هذه المحادثة مربوطة مسبقاً برابط نشط');
    }

    const link = await this.linkModel.create({
      tenantId: tenantObjectId,
      doctorPhone: dto.professional.phone,
      doctorName: dto.professional.name,
      doctorChatId: professionalChatId,
      patientPhone: dto.client.phone,
      patientName: dto.client.name,
      patientChatId: clientChatId,
      patientLabel: this.generatePatientLabel(),
      status: DoctorRelayLinkStatus.ACTIVE,
      createdByUserId: new Types.ObjectId(user.id),
    });

    this.gateway.emitLinkNew(companyId, { link: link.toObject() });
    return link.toObject();
  }

  private resolveChatIdLenient(chatId: string | undefined, phone: string): string | null {
    if (chatId && chatId.includes('@')) {
      return chatId;
    }
    const cleanPhone = (phone || '').replace(/\D/g, '');
    return cleanPhone ? `${cleanPhone}@c.us` : null;
  }

  private async upsertPersonByPhone(
    model: Model<any>,
    tenantId: Types.ObjectId,
    name: string,
    phone: string,
  ) {
    await model.updateOne(
      { tenantId, phone },
      {
        $set: { name: name || phone },
        $setOnInsert: { tenantId, phone, status: DoctorRelayPersonStatus.ACTIVE },
      },
      { upsert: true },
    );
  }

  async listLinks(user: DoctorRelayUserContext, companyId?: string) {
    const effectiveCompanyId = await this.resolveCompanyId(user, companyId);
    this.assertHasPermission(user, DoctorRelayPermission.LINKS_VIEW);
    return this.linkModel
      .find({ tenantId: new Types.ObjectId(effectiveCompanyId) })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();
  }

  async closeLink(user: DoctorRelayUserContext, linkId: string) {
    const companyId = await this.resolveCompanyId(user);
    const link = await this.linkModel.findOne({
      _id: new Types.ObjectId(linkId),
      tenantId: new Types.ObjectId(companyId),
    });
    if (!link) {
      throw new NotFoundException('Link not found');
    }

    const canCloseAny = hasDoctorRelayPermission(user, DoctorRelayPermission.LINKS_MANAGE);
    const isOwnLink =
      hasDoctorRelayPermission(user, DoctorRelayPermission.LINKS_CREATE) &&
      String(link.createdByUserId) === user.id;
    if (!canCloseAny && !isOwnLink) {
      throw new ForbiddenException('يمكنك إغلاق الروابط التي أنشأتها فقط');
    }

    link.status = DoctorRelayLinkStatus.CLOSED;
    link.closedAt = new Date();
    await link.save();

    const serialized = link.toObject();
    this.gateway.emitLinkUpdated(companyId, { link: serialized });
    return serialized;
  }

  async listMessages(user: DoctorRelayUserContext, linkId: string) {
    const companyId = await this.resolveCompanyId(user);
    this.assertHasPermission(user, DoctorRelayPermission.CONVERSATIONS_VIEW);
    const link = await this.linkModel.findOne({
      _id: new Types.ObjectId(linkId),
      tenantId: new Types.ObjectId(companyId),
    });
    if (!link) {
      throw new NotFoundException('Link not found');
    }

    return this.messageModel
      .find({ tenantId: link.tenantId, linkId: link._id })
      .sort({ createdAt: 1 })
      .lean();
  }

  private async handleIncomingMessage(event: IncomingWhatsappMessageEvent) {
    const isEnabled = await this.isDoctorRelayEnabled(event.tenantId);
    if (!isEnabled) {
      return;
    }

    // Only react to messages actually sent by the remote party, not our own forwards.
    if (event.direction !== 'incoming') {
      return;
    }

    const tenantObjectId = new Types.ObjectId(event.tenantId);

    const linkAsPatient = await this.linkModel.findOne({
      tenantId: tenantObjectId,
      patientChatId: event.whatsappChatId,
      status: DoctorRelayLinkStatus.ACTIVE,
    });

    if (linkAsPatient) {
      await this.relayPatientToDoctor(linkAsPatient, event);
      return;
    }

    const linkAsDoctor = await this.linkModel.findOne({
      tenantId: tenantObjectId,
      doctorChatId: event.whatsappChatId,
      status: DoctorRelayLinkStatus.ACTIVE,
    });

    if (linkAsDoctor) {
      await this.relayDoctorToPatient(linkAsDoctor, event);
    }
  }

  private async relayPatientToDoctor(
    link: DoctorRelayLinkDocument,
    event: IncomingWhatsappMessageEvent,
  ) {
    const settings = await this.getDoctorRelaySettings(String(link.tenantId));
    const forwardedBody = `🔵 ${settings.clientLabel} ${link.patientLabel}:\n${event.body}`;
    const pendingMessage = await this.messageModel.create({
      tenantId: link.tenantId,
      linkId: link._id,
      direction: DoctorRelayMessageDirection.PATIENT_TO_DOCTOR,
      body: event.body,
      sourceWhatsappMessageId: event.whatsappMessageId,
      forwardedWhatsappMessageId: null,
      status: DoctorRelayMessageStatus.PENDING,
    });

    try {
      const result = await this.forwardToChat(
        String(link.tenantId),
        link.doctorChatId,
        event,
        forwardedBody,
      );
      pendingMessage.forwardedWhatsappMessageId = result.providerMessageId ?? null;
      pendingMessage.status = DoctorRelayMessageStatus.SENT;
      await pendingMessage.save();

      link.lastMessage = event.body;
      link.lastMessageAt = new Date();
      await link.save();

      this.gateway.emitMessageNew(String(link.tenantId), {
        linkId: String(link._id),
        message: pendingMessage.toObject(),
      });
    } catch (error) {
      pendingMessage.status = DoctorRelayMessageStatus.FAILED;
      pendingMessage.errorMessage =
        error instanceof Error ? error.message : 'Failed to relay message to doctor';
      await pendingMessage.save();
      this.logger.warn(
        `Failed to relay patient message for link ${link.id}: ${pendingMessage.errorMessage}`,
      );
    }
  }

  /**
   * Forwards one message to the other party. Images/documents must be re-sent as
   * media — relaying only `body` silently dropped every photo and file.
   */
  private async forwardToChat(
    tenantId: string,
    chatId: string,
    event: IncomingWhatsappMessageEvent,
    caption: string,
  ): Promise<{ providerMessageId?: string }> {
    if (event.mediaUrl) {
      try {
        const relative = event.mediaUrl.replace(/^\/+/, '');
        const filePath = path.join(process.cwd(), relative);
        const data = await fs.readFile(filePath);
        return await this.whatsappSessionsService.sendMediaMessage(
          tenantId,
          chatId,
          data.toString('base64'),
          event.mediaMimeType || 'application/octet-stream',
          event.mediaFileName || path.basename(filePath),
          caption || undefined,
        );
      } catch (error) {
        this.logger.warn(
          `Media forward failed, falling back to text: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }

    const text = caption || event.body || '';
    if (!text.trim()) {
      // The attachment could not be pulled from WhatsApp. Say so plainly rather than
      // dropping it silently, so the recipient knows to ask for it another way.
      return this.whatsappSessionsService.sendTextMessage(
        tenantId,
        chatId,
        '📎 تم إرسال مرفق (صورة أو ملف) لكن تعذّر توصيله تلقائياً. الرجاء طلبه مرة أخرى.',
      );
    }
    return this.whatsappSessionsService.sendTextMessage(tenantId, chatId, text);
  }

  /**
   * Works out which patient a doctor's reply is meant for, without relying on
   * WhatsApp message ids (which are often unavailable).
   */
  private async resolveDoctorReplyTarget(
    link: DoctorRelayLinkDocument,
    event: IncomingWhatsappMessageEvent,
  ): Promise<DoctorRelayLinkDocument | null> {
    // 1. Exact match on the id of the message we forwarded.
    if (event.quotedWhatsappMessageId) {
      const quoted = await this.messageModel.findOne({
        tenantId: link.tenantId,
        forwardedWhatsappMessageId: event.quotedWhatsappMessageId,
      });
      if (quoted) {
        const byId = await this.linkModel.findById(quoted.linkId);
        if (byId && byId.status === DoctorRelayLinkStatus.ACTIVE) return byId;
      }
    }

    // All of this doctor's currently open conversations.
    const doctorLinks = await this.linkModel.find({
      tenantId: link.tenantId,
      doctorChatId: link.doctorChatId,
      status: DoctorRelayLinkStatus.ACTIVE,
    });

    // 2. The forwarded text starts with "🔵 <label> <CODE>:", so if the doctor quoted
    //    it we can read the patient code straight out of the quoted body.
    if (event.quotedBody) {
      const quotedText = event.quotedBody;
      const matched = doctorLinks.find(
        (candidate) => candidate.patientLabel && quotedText.includes(candidate.patientLabel),
      );
      if (matched) return matched;
    }

    // 3. Only one patient open with this doctor — no ambiguity, so no quote needed.
    if (doctorLinks.length === 1) return doctorLinks[0];

    return null;
  }

  private async relayDoctorToPatient(
    link: DoctorRelayLinkDocument,
    event: IncomingWhatsappMessageEvent,
  ) {
    // Resolving which patient this reply belongs to must NOT depend on WhatsApp
    // message ids: current WhatsApp Web builds frequently fail to produce them, which
    // made every doctor reply get rejected as "unquoted". Try, in order:
    //   1. the quoted message id (ideal, when WhatsApp gives us one),
    //   2. the patient code inside the quoted TEXT,
    //   3. the doctor's only open conversation — no quoting needed at all.
    const targetLink = await this.resolveDoctorReplyTarget(link, event);
    if (!targetLink) {
      await this.rejectUnquotedDoctorReply(link, event);
      return;
    }
    link = targetLink;

    const pendingMessage = await this.messageModel.create({
      tenantId: link.tenantId,
      linkId: link._id,
      direction: DoctorRelayMessageDirection.DOCTOR_TO_PATIENT,
      body: event.body,
      sourceWhatsappMessageId: event.whatsappMessageId,
      forwardedWhatsappMessageId: null,
      status: DoctorRelayMessageStatus.PENDING,
    });

    try {
      const result = await this.forwardToChat(
        String(link.tenantId),
        link.patientChatId,
        event,
        event.body,
      );
      pendingMessage.forwardedWhatsappMessageId = result.providerMessageId ?? null;
      pendingMessage.status = DoctorRelayMessageStatus.SENT;
      await pendingMessage.save();

      link.lastMessage = event.body;
      link.lastMessageAt = new Date();
      await link.save();

      this.gateway.emitMessageNew(String(link.tenantId), {
        linkId: String(link._id),
        message: pendingMessage.toObject(),
      });
    } catch (error) {
      pendingMessage.status = DoctorRelayMessageStatus.FAILED;
      pendingMessage.errorMessage =
        error instanceof Error ? error.message : 'Failed to relay message to patient';
      await pendingMessage.save();
      this.logger.warn(
        `Failed to relay doctor reply for link ${link.id}: ${pendingMessage.errorMessage}`,
      );
    }
  }

  private async rejectUnquotedDoctorReply(
    link: DoctorRelayLinkDocument,
    event: IncomingWhatsappMessageEvent,
  ) {
    await this.messageModel.create({
      tenantId: link.tenantId,
      linkId: link._id,
      direction: DoctorRelayMessageDirection.DOCTOR_TO_PATIENT,
      body: event.body,
      sourceWhatsappMessageId: event.whatsappMessageId,
      forwardedWhatsappMessageId: null,
      status: DoctorRelayMessageStatus.REJECTED_UNQUOTED,
    });

    try {
      const settings = await this.getDoctorRelaySettings(String(link.tenantId));
      // Only reached when the doctor has several open conversations, so list the codes
      // to make picking the right one obvious.
      const openLinks = await this.linkModel.find({
        tenantId: link.tenantId,
        doctorChatId: link.doctorChatId,
        status: DoctorRelayLinkStatus.ACTIVE,
      });
      const codes = openLinks.map((item) => `• ${item.patientLabel}`).join('\n');
      await this.whatsappSessionsService.sendTextMessage(
        String(link.tenantId),
        link.doctorChatId,
        `لديك أكثر من ${settings.clientLabel} مفتوح، لذلك لم نتمكن من تحديد وجهة ردكم.\n\n` +
          `الرجاء الرد بالاقتباس (Reply) على رسالة ${settings.clientLabel} المقصود.\n\n` +
          `الرموز المفتوحة حالياً:\n${codes}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send unquoted-reply warning for link ${link.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private generatePatientLabel() {
    return Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  private async resolveCompanyId(user: DoctorRelayUserContext, explicitCompanyId?: string) {
    const companyId = user.role === UserRole.SUPER_ADMIN ? explicitCompanyId : user.tenantId;

    if (!companyId) {
      throw new ForbiddenException('Company ID is required');
    }

    const enabled = await this.isDoctorRelayEnabled(companyId);
    if (!enabled) {
      throw new ForbiddenException('Doctor Relay is not enabled for this company');
    }

    return companyId;
  }

  private async getDoctorRelaySettings(companyId: string): Promise<DoctorRelaySettings> {
    const tenant = await this.tenantsService.findById(companyId);
    return this.mergeDoctorRelaySettings(tenant.settings);
  }

  private mergeDoctorRelaySettings(settings: Record<string, unknown> | undefined) {
    const doctorRelaySettings = ((settings?.['doctorRelay'] as Partial<DoctorRelaySettings>) ||
      {}) as Partial<DoctorRelaySettings>;
    return {
      ...DEFAULT_DOCTOR_RELAY_SETTINGS,
      ...doctorRelaySettings,
    };
  }

  private async isDoctorRelayEnabled(companyId: string) {
    const tenant = await this.tenantsService.findById(companyId);
    return (tenant.enabledProducts || []).includes(TenantProduct.DOCTOR_RELAY);
  }

  private assertHasPermission(
    user: DoctorRelayUserContext,
    permission: (typeof DoctorRelayPermission)[keyof typeof DoctorRelayPermission],
  ) {
    if (!hasDoctorRelayPermission(user, permission)) {
      throw new ForbiddenException('ليس لديك صلاحية لتنفيذ هذا الإجراء على روابط التوجيه');
    }
  }
}
