import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { CreateDoctorRelayDoctorDto } from './dto/create-doctor-relay-doctor.dto';
import { CreateDoctorRelayLinkDto } from './dto/create-doctor-relay-link.dto';
import { CreateDoctorRelayPatientDto } from './dto/create-doctor-relay-patient.dto';
import { LinkConversationsDto } from './dto/link-conversations.dto';
import { UpdateDoctorRelaySettingsDto } from './dto/update-doctor-relay-settings.dto';
import { DoctorRelayService, DoctorRelayUserContext } from './doctor-relay.service';

const DOCTOR_RELAY_USERS = [
  UserRole.SUPER_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.AGENT,
];

@ApiTags('Doctor Relay')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CompanyAccessGuard)
@Controller('api/doctor-relay')
export class DoctorRelayController {
  constructor(private readonly doctorRelayService: DoctorRelayService) {}

  @Get('settings')
  @Roles(...DOCTOR_RELAY_USERS)
  getSettings(
    @CurrentUser() user: DoctorRelayUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.doctorRelayService.getSettings(user, companyId);
  }

  @Patch('settings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  updateSettings(
    @CurrentUser() user: DoctorRelayUserContext,
    @Body() dto: UpdateDoctorRelaySettingsDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.doctorRelayService.updateSettings(user, dto, companyId);
  }

  @Get('doctors')
  @Roles(...DOCTOR_RELAY_USERS)
  listDoctors(
    @CurrentUser() user: DoctorRelayUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.doctorRelayService.listDoctors(user, companyId);
  }

  @Post('doctors')
  @Roles(...DOCTOR_RELAY_USERS)
  createDoctor(
    @CurrentUser() user: DoctorRelayUserContext,
    @Body() dto: CreateDoctorRelayDoctorDto,
  ) {
    return this.doctorRelayService.createDoctor(user, dto);
  }

  @Get('patients')
  @Roles(...DOCTOR_RELAY_USERS)
  listPatients(
    @CurrentUser() user: DoctorRelayUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.doctorRelayService.listPatients(user, companyId);
  }

  @Post('patients')
  @Roles(...DOCTOR_RELAY_USERS)
  createPatient(
    @CurrentUser() user: DoctorRelayUserContext,
    @Body() dto: CreateDoctorRelayPatientDto,
  ) {
    return this.doctorRelayService.createPatient(user, dto);
  }

  @Get('links')
  @Roles(...DOCTOR_RELAY_USERS)
  listLinks(
    @CurrentUser() user: DoctorRelayUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.doctorRelayService.listLinks(user, companyId);
  }

  @Post('links')
  @Roles(...DOCTOR_RELAY_USERS)
  createLink(
    @CurrentUser() user: DoctorRelayUserContext,
    @Body() dto: CreateDoctorRelayLinkDto,
  ) {
    return this.doctorRelayService.createLink(user, dto);
  }

  @Post('link-conversations')
  @Roles(...DOCTOR_RELAY_USERS)
  linkFromConversations(
    @CurrentUser() user: DoctorRelayUserContext,
    @Body() dto: LinkConversationsDto,
  ) {
    return this.doctorRelayService.linkFromConversations(user, dto);
  }

  @Patch('links/:id/close')
  @Roles(...DOCTOR_RELAY_USERS)
  closeLink(@CurrentUser() user: DoctorRelayUserContext, @Param('id') id: string) {
    return this.doctorRelayService.closeLink(user, id);
  }

  @Get('links/:id/messages')
  @Roles(...DOCTOR_RELAY_USERS)
  listMessages(@CurrentUser() user: DoctorRelayUserContext, @Param('id') id: string) {
    return this.doctorRelayService.listMessages(user, id);
  }
}
