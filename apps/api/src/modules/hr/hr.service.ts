import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TenantsService } from '../tenants/tenants.service';
import { TenantProduct } from '../tenants/schemas/tenant.schema';
import { UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { WhatsappSessionsService } from '../whatsapp-sessions/whatsapp-sessions.service';
import { ApplyHrJobDto } from './dto/apply-hr-job.dto';
import { AssignApplicationDto } from './dto/assign-application.dto';
import { CreateHrJobDto } from './dto/create-hr-job.dto';
import { CreateHrUserDto } from './dto/create-hr-user.dto';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { SendApplicationMessageDto } from './dto/send-application-message.dto';
import { UpdateApplicationStageDto } from './dto/update-application-stage.dto';
import { UpdateHrJobDto } from './dto/update-hr-job.dto';
import {
  HrApplication,
  HrApplicationDocument,
  HrApplicationStage,
} from './schemas/hr-application.schema';
import { HrCandidate, HrCandidateDocument } from './schemas/hr-candidate.schema';
import { HrJob, HrJobDocument, HrJobStatus } from './schemas/hr-job.schema';
import {
  HrMessageTemplate,
  HrMessageTemplateDocument,
} from './schemas/hr-message-template.schema';
import {
  HrTimelineEvent,
  HrTimelineEventDocument,
  HrTimelineEventType,
} from './schemas/hr-timeline-event.schema';

export interface HrUserContext {
  id: string;
  role: UserRole;
  tenantId: string | null;
  name?: string;
}

@Injectable()
export class HrService {
  constructor(
    @InjectModel(HrJob.name)
    private readonly jobModel: Model<HrJobDocument>,
    @InjectModel(HrCandidate.name)
    private readonly candidateModel: Model<HrCandidateDocument>,
    @InjectModel(HrApplication.name)
    private readonly applicationModel: Model<HrApplicationDocument>,
    @InjectModel(HrTimelineEvent.name)
    private readonly timelineModel: Model<HrTimelineEventDocument>,
    @InjectModel(HrMessageTemplate.name)
    private readonly templateModel: Model<HrMessageTemplateDocument>,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly whatsappSessionsService: WhatsappSessionsService,
  ) {}

  async overview(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);
    const applicationFilter = await this.applicationScope(user, effectiveTenantId);
    const [jobs, applications, candidates, reports] = await Promise.all([
      this.jobModel.countDocuments({
        tenantId: new Types.ObjectId(effectiveTenantId),
        status: HrJobStatus.OPEN,
      }),
      this.applicationModel.countDocuments(applicationFilter),
      this.candidateModel.countDocuments({
        tenantId: new Types.ObjectId(effectiveTenantId),
      }),
      this.employeeReports(user, effectiveTenantId),
    ]);

    const stages = await this.applicationModel.aggregate([
      { $match: applicationFilter },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return {
      summary: {
        openJobs: jobs,
        applications,
        candidates,
        employees: reports.length,
      },
      stages: stages.map((item) => ({
        stage: item._id,
        count: item.count,
      })),
      reports,
    };
  }

  async createJob(user: HrUserContext, dto: CreateHrJobDto) {
    const tenantId = await this.resolveTenantId(user, dto.tenantId);
    this.assertManager(user);

    return this.jobModel.create({
      tenantId: new Types.ObjectId(tenantId),
      title: dto.title,
      slug: dto.slug.trim().toLowerCase(),
      department: dto.department || '',
      city: dto.city || '',
      employmentType: dto.employmentType || '',
      salaryRange: dto.salaryRange || '',
      description: dto.description,
      requirements: dto.requirements || '',
      status: dto.status || HrJobStatus.OPEN,
      ownerUserId:
        user.id && user.role !== UserRole.SUPER_ADMIN
          ? new Types.ObjectId(user.id)
          : null,
    });
  }

  async listJobs(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);
    return this.jobModel
      .find({ tenantId: new Types.ObjectId(effectiveTenantId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async updateJob(user: HrUserContext, jobId: string, dto: UpdateHrJobDto) {
    const tenantId = await this.resolveTenantId(user, dto.tenantId);
    this.assertManager(user);
    const { tenantId: _tenantId, ...updates } = dto;
    const job = await this.jobModel.findOneAndUpdate(
      { _id: new Types.ObjectId(jobId), tenantId: new Types.ObjectId(tenantId) },
      {
        ...updates,
        slug: dto.slug ? dto.slug.trim().toLowerCase() : undefined,
      },
      { new: true },
    );

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async getPublicJob(slug: string) {
    const job = await this.jobModel
      .findOne({ slug: slug.toLowerCase(), status: HrJobStatus.OPEN })
      .lean();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async applyToJob(slug: string, dto: ApplyHrJobDto) {
    const job = await this.getPublicJob(slug);
    const candidate = await this.candidateModel.create({
      tenantId: job.tenantId,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      email: dto.email || '',
      city: dto.city || '',
      experience: dto.experience || '',
      expectedSalary: dto.expectedSalary || '',
      cvUrl: dto.cvUrl || '',
      notes: dto.notes || '',
      source: dto.source || 'public_form',
    });
    const application = await this.applicationModel.create({
      tenantId: job.tenantId,
      jobId: job._id,
      candidateId: candidate._id,
      stage: HrApplicationStage.NEW,
      source: dto.source || 'public_form',
      lastActivityAt: new Date(),
    });

    await this.addTimeline({
      tenantId: String(job.tenantId),
      applicationId: application.id,
      candidateId: candidate.id,
      type: HrTimelineEventType.APPLIED,
      title: 'New application',
      body: `${candidate.fullName} applied for ${job.title}`,
      metadata: { source: dto.source || 'public_form' },
    });

    return {
      message: 'Application submitted successfully',
      applicationId: application.id,
    };
  }

  async listCandidates(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);

    if (user.role === UserRole.RECRUITER) {
      const applications = await this.applicationModel
        .find({
          tenantId: new Types.ObjectId(effectiveTenantId),
          assignedToUserId: new Types.ObjectId(user.id),
        })
        .select('candidateId')
        .lean();
      const candidateIds = applications.map((item) => item.candidateId);

      return this.candidateModel
        .find({ _id: { $in: candidateIds } })
        .sort({ createdAt: -1 })
        .lean();
    }

    return this.candidateModel
      .find({ tenantId: new Types.ObjectId(effectiveTenantId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getCandidate(user: HrUserContext, candidateId: string) {
    const tenantId = await this.resolveTenantId(user);
    const candidate = await this.candidateModel
      .findOne({
        _id: new Types.ObjectId(candidateId),
        tenantId: new Types.ObjectId(tenantId),
      })
      .lean();

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (user.role === UserRole.RECRUITER) {
      const application = await this.applicationModel.findOne({
        candidateId: candidate._id,
        assignedToUserId: new Types.ObjectId(user.id),
      });

      if (!application) {
        throw new ForbiddenException('Candidate is not assigned to this recruiter');
      }
    }

    return candidate;
  }

  async listApplications(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);
    const filter = await this.applicationScope(user, effectiveTenantId);
    const applications = await this.applicationModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return this.hydrateApplications(applications);
  }

  async inbox(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);
    const filter = await this.applicationScope(user, effectiveTenantId);
    const applications = await this.applicationModel
      .find(filter)
      .sort({ lastActivityAt: -1, updatedAt: -1 })
      .lean();

    return this.hydrateApplications(applications);
  }

  async assignApplication(
    user: HrUserContext,
    applicationId: string,
    dto: AssignApplicationDto,
  ) {
    const tenantId = await this.resolveTenantId(user);
    this.assertManager(user);
    const application = await this.applicationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(applicationId),
        tenantId: new Types.ObjectId(tenantId),
      },
      {
        assignedToUserId: new Types.ObjectId(dto.assignedToUserId),
        lastActivityAt: new Date(),
      },
      { new: true },
    );

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.addTimeline({
      tenantId,
      applicationId,
      candidateId: String(application.candidateId),
      createdByUserId: user.id,
      type: HrTimelineEventType.ASSIGNED,
      title: 'Candidate assigned',
      body: `Assigned to user ${dto.assignedToUserId}`,
      metadata: { assignedToUserId: dto.assignedToUserId },
    });

    return application;
  }

  async updateStage(
    user: HrUserContext,
    applicationId: string,
    dto: UpdateApplicationStageDto,
  ) {
    const application = await this.getScopedApplication(user, applicationId);
    const previousStage = application.stage;
    application.stage = dto.stage;
    application.lastActivityAt = new Date();
    await application.save();

    await this.addTimeline({
      tenantId: String(application.tenantId),
      applicationId,
      candidateId: String(application.candidateId),
      createdByUserId: user.id,
      type: HrTimelineEventType.STAGE_CHANGED,
      title: 'Stage changed',
      body: `${previousStage} -> ${dto.stage}`,
      metadata: { previousStage, nextStage: dto.stage },
    });

    return application;
  }

  async sendMessage(
    user: HrUserContext,
    applicationId: string,
    dto: SendApplicationMessageDto,
  ) {
    const application = await this.getScopedApplication(user, applicationId);
    const [candidate, job] = await Promise.all([
      this.candidateModel.findById(application.candidateId).lean(),
      this.jobModel.findById(application.jobId).lean(),
    ]);

    if (!candidate || !job) {
      throw new NotFoundException('Application details not found');
    }

    let message = dto.message || '';
    if (dto.templateId) {
      const template = await this.templateModel.findOne({
        _id: new Types.ObjectId(dto.templateId),
        tenantId: application.tenantId,
        status: 'active',
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      message = template.body;
    }

    if (!message.trim()) {
      throw new NotFoundException('Message or template is required');
    }

    const renderedMessage = this.renderTemplate(message, {
      candidateName: candidate.fullName,
      jobTitle: job.title,
      recruiterName: user.name || 'Recruiter',
    });
    const result = await this.whatsappSessionsService.sendTextMessage(
      String(application.tenantId),
      candidate.phoneNumber,
      renderedMessage,
    );

    const now = new Date();
    application.firstResponseAt = application.firstResponseAt || now;
    application.lastActivityAt = now;
    if (application.stage === HrApplicationStage.NEW) {
      application.stage = HrApplicationStage.CONTACTED;
    }
    await application.save();

    await this.addTimeline({
      tenantId: String(application.tenantId),
      applicationId,
      candidateId: String(application.candidateId),
      createdByUserId: user.id,
      type: HrTimelineEventType.MESSAGE_SENT,
      title: 'WhatsApp message sent',
      body: renderedMessage,
      metadata: result,
    });

    return {
      message: 'Message sent successfully',
      providerMessageId: result.providerMessageId,
    };
  }

  async timeline(user: HrUserContext, applicationId: string) {
    const application = await this.getScopedApplication(user, applicationId);
    return this.timelineModel
      .find({
        applicationId: application._id,
        tenantId: application.tenantId,
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async createTemplate(user: HrUserContext, dto: CreateMessageTemplateDto) {
    const tenantId = await this.resolveTenantId(user, dto.tenantId);
    this.assertManager(user);

    return this.templateModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name,
      stage: dto.stage || 'general',
      body: dto.body,
      status: 'active',
    });
  }

  async listTemplates(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);
    return this.templateModel
      .find({
        tenantId: new Types.ObjectId(effectiveTenantId),
        status: 'active',
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async createHrUser(user: HrUserContext, dto: CreateHrUserDto) {
    const tenantId = await this.resolveTenantId(user, dto.tenantId);
    this.assertManager(user);

    if (![UserRole.HR_MANAGER, UserRole.RECRUITER].includes(dto.role)) {
      throw new ForbiddenException('Only HR users can be created here');
    }

    return this.usersService.createUser({
      tenantId,
      role: dto.role,
      name: dto.name,
      email: dto.email,
      password: dto.password,
    });
  }

  async listEmployees(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);
    this.assertManager(user);
    const users = await this.usersService.listForTenant(effectiveTenantId);
    return users.filter((item) =>
      [UserRole.TENANT_ADMIN, UserRole.HR_MANAGER, UserRole.RECRUITER].includes(
        item.role,
      ),
    );
  }

  async employeeReports(user: HrUserContext, tenantId?: string) {
    const effectiveTenantId = await this.resolveTenantId(user, tenantId);
    this.assertManager(user);
    const employees = await this.usersService.listForTenant(effectiveTenantId);
    const hrEmployees = employees.filter((item) =>
      [UserRole.TENANT_ADMIN, UserRole.HR_MANAGER, UserRole.RECRUITER].includes(
        item.role,
      ),
    );
    const reports = await Promise.all(
      hrEmployees.map(async (employee) => {
        const userObjectId = new Types.ObjectId(employee.id);
        const applications = await this.applicationModel
          .find({
            tenantId: new Types.ObjectId(effectiveTenantId),
            assignedToUserId: userObjectId,
          })
          .lean();
        const applicationIds = applications.map((item) => item._id);
        const messageCount = await this.timelineModel.countDocuments({
          tenantId: new Types.ObjectId(effectiveTenantId),
          createdByUserId: userObjectId,
          type: HrTimelineEventType.MESSAGE_SENT,
        });
        const interviews = applications.filter(
          (item) => item.stage === HrApplicationStage.INTERVIEW,
        ).length;
        const accepted = applications.filter(
          (item) => item.stage === HrApplicationStage.ACCEPTED,
        ).length;
        const rejected = applications.filter(
          (item) => item.stage === HrApplicationStage.REJECTED,
        ).length;
        const firstResponseTimes = applications
          .filter((item: any) => item.firstResponseAt && item.createdAt)
          .map((item: any) =>
            Math.max(
              0,
              new Date(item.firstResponseAt).getTime() -
                new Date(item.createdAt).getTime(),
            ),
          );
        const averageFirstResponseMinutes = firstResponseTimes.length
          ? Math.round(
              firstResponseTimes.reduce((sum, item) => sum + item, 0) /
                firstResponseTimes.length /
                60000,
            )
          : null;
        const staleSince = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const staleApplications = applications.filter(
          (item: any) =>
            !item.lastActivityAt || new Date(item.lastActivityAt) < staleSince,
        ).length;

        return {
          employee,
          assigned: applications.length,
          applicationIds,
          messagesSent: messageCount,
          contacted: applications.filter((item) => item.firstResponseAt).length,
          interviews,
          accepted,
          rejected,
          averageFirstResponseMinutes,
          staleApplications,
        };
      }),
    );

    return reports.sort((a, b) => b.messagesSent - a.messagesSent);
  }

  private async resolveTenantId(user: HrUserContext, explicitTenantId?: string) {
    const tenantId =
      user.role === UserRole.SUPER_ADMIN ? explicitTenantId : user.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    const tenant = await this.tenantsService.findById(tenantId);
    const enabledProducts = tenant.enabledProducts || [];
    if (!enabledProducts.includes(TenantProduct.HR)) {
      throw new ForbiddenException('HR product is not enabled for this tenant');
    }

    return tenantId;
  }

  private assertManager(user: HrUserContext) {
    if (
      ![
        UserRole.SUPER_ADMIN,
        UserRole.TENANT_ADMIN,
        UserRole.HR_MANAGER,
      ].includes(user.role)
    ) {
      throw new ForbiddenException('HR manager permission is required');
    }
  }

  private async applicationScope(user: HrUserContext, tenantId: string) {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
    };

    if (user.role === UserRole.RECRUITER) {
      filter.assignedToUserId = new Types.ObjectId(user.id);
    }

    return filter;
  }

  private async getScopedApplication(user: HrUserContext, applicationId: string) {
    const tenantId = await this.resolveTenantId(user);
    const filter = await this.applicationScope(user, tenantId);
    const application = await this.applicationModel.findOne({
      ...filter,
      _id: new Types.ObjectId(applicationId),
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  private async hydrateApplications(applications: any[]) {
    const candidateIds = applications.map((item) => item.candidateId);
    const jobIds = applications.map((item) => item.jobId);
    const userIds = applications
      .map((item) => item.assignedToUserId)
      .filter(Boolean);
    const [candidates, jobs, users] = await Promise.all([
      this.candidateModel.find({ _id: { $in: candidateIds } }).lean(),
      this.jobModel.find({ _id: { $in: jobIds } }).lean(),
      userIds.length
        ? Promise.all(userIds.map((id) => this.usersService.findById(String(id))))
        : Promise.resolve([]),
    ]);
    const candidateMap = new Map(candidates.map((item: any) => [String(item._id), item]));
    const jobMap = new Map(jobs.map((item: any) => [String(item._id), item]));
    const userMap = new Map(users.map((item: any) => [String(item.id), item]));

    return applications.map((application: any) => ({
      ...application,
      candidate: candidateMap.get(String(application.candidateId)) || null,
      job: jobMap.get(String(application.jobId)) || null,
      assignedTo: application.assignedToUserId
        ? userMap.get(String(application.assignedToUserId)) || null
        : null,
    }));
  }

  private async addTimeline(input: {
    tenantId: string;
    applicationId: string;
    candidateId: string;
    createdByUserId?: string;
    type: HrTimelineEventType;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.timelineModel.create({
      tenantId: new Types.ObjectId(input.tenantId),
      applicationId: new Types.ObjectId(input.applicationId),
      candidateId: new Types.ObjectId(input.candidateId),
      createdByUserId: input.createdByUserId
        ? new Types.ObjectId(input.createdByUserId)
        : null,
      type: input.type,
      title: input.title,
      body: input.body || '',
      metadata: input.metadata || {},
    });
  }

  private renderTemplate(template: string, variables: Record<string, string>) {
    return Object.entries(variables).reduce(
      (message, [key, value]) =>
        message.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value),
      template,
    );
  }
}
