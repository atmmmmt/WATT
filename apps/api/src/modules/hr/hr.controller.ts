import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { AssignApplicationDto } from './dto/assign-application.dto';
import { CreateHrJobDto } from './dto/create-hr-job.dto';
import { CreateHrUserDto } from './dto/create-hr-user.dto';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { SendApplicationMessageDto } from './dto/send-application-message.dto';
import { UpdateApplicationStageDto } from './dto/update-application-stage.dto';
import { UpdateHrJobDto } from './dto/update-hr-job.dto';
import { HrService, HrUserContext } from './hr.service';

const HR_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.RECRUITER,
];

@ApiTags('HR Recruiting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get('overview')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'HR dashboard overview' })
  overview(@CurrentUser() user: HrUserContext, @Query('tenantId') tenantId?: string) {
    return this.hrService.overview(user, tenantId);
  }

  @Post('jobs')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Create HR job' })
  createJob(@CurrentUser() user: HrUserContext, @Body() dto: CreateHrJobDto) {
    return this.hrService.createJob(user, dto);
  }

  @Get('jobs')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'List HR jobs' })
  listJobs(@CurrentUser() user: HrUserContext, @Query('tenantId') tenantId?: string) {
    return this.hrService.listJobs(user, tenantId);
  }

  @Patch('jobs/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Update HR job' })
  updateJob(
    @CurrentUser() user: HrUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateHrJobDto,
  ) {
    return this.hrService.updateJob(user, id, dto);
  }

  @Get('candidates')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'List HR candidates' })
  listCandidates(
    @CurrentUser() user: HrUserContext,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.hrService.listCandidates(user, tenantId);
  }

  @Get('candidates/:id')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'Get HR candidate details' })
  getCandidate(@CurrentUser() user: HrUserContext, @Param('id') id: string) {
    return this.hrService.getCandidate(user, id);
  }

  @Get('applications')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'List HR applications' })
  listApplications(
    @CurrentUser() user: HrUserContext,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.hrService.listApplications(user, tenantId);
  }

  @Get('inbox')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'Get current HR inbox' })
  inbox(@CurrentUser() user: HrUserContext, @Query('tenantId') tenantId?: string) {
    return this.hrService.inbox(user, tenantId);
  }

  @Patch('applications/:id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Assign application to recruiter' })
  assign(
    @CurrentUser() user: HrUserContext,
    @Param('id') id: string,
    @Body() dto: AssignApplicationDto,
  ) {
    return this.hrService.assignApplication(user, id, dto);
  }

  @Patch('applications/:id/stage')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'Move application to another stage' })
  updateStage(
    @CurrentUser() user: HrUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStageDto,
  ) {
    return this.hrService.updateStage(user, id, dto);
  }

  @Post('applications/:id/message')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'Send WhatsApp message to candidate' })
  sendMessage(
    @CurrentUser() user: HrUserContext,
    @Param('id') id: string,
    @Body() dto: SendApplicationMessageDto,
  ) {
    return this.hrService.sendMessage(user, id, dto);
  }

  @Get('applications/:id/timeline')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'Get application timeline' })
  timeline(@CurrentUser() user: HrUserContext, @Param('id') id: string) {
    return this.hrService.timeline(user, id);
  }

  @Post('message-templates')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Create HR WhatsApp template' })
  createTemplate(
    @CurrentUser() user: HrUserContext,
    @Body() dto: CreateMessageTemplateDto,
  ) {
    return this.hrService.createTemplate(user, dto);
  }

  @Get('message-templates')
  @Roles(...HR_ROLES)
  @ApiOperation({ summary: 'List HR WhatsApp templates' })
  listTemplates(
    @CurrentUser() user: HrUserContext,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.hrService.listTemplates(user, tenantId);
  }

  @Post('employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Create HR manager or recruiter' })
  createEmployee(
    @CurrentUser() user: HrUserContext,
    @Body() dto: CreateHrUserDto,
  ) {
    return this.hrService.createHrUser(user, dto);
  }

  @Get('employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'List HR employees' })
  listEmployees(
    @CurrentUser() user: HrUserContext,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.hrService.listEmployees(user, tenantId);
  }

  @Get('reports/employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Employee performance report' })
  employeeReports(
    @CurrentUser() user: HrUserContext,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.hrService.employeeReports(user, tenantId);
  }
}
