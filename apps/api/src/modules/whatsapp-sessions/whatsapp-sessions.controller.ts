import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { WhatsappSessionsService } from './whatsapp-sessions.service';

class TenantSessionDto {
  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}

@ApiTags('WhatsApp Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whatsapp-sessions')
export class WhatsappSessionsController {
  constructor(
    private readonly whatsappSessionsService: WhatsappSessionsService,
  ) {}

  @Post('start')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.HR_MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Start a QR-based WhatsApp Web session for a tenant' })
  start(
    @Body() dto: TenantSessionDto,
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
  ) {
    const tenantId =
      user.role === UserRole.SUPER_ADMIN ? dto.tenantId : (user.tenantId as string);
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.whatsappSessionsService.startSession(tenantId);
  }

  @Post('disconnect')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.HR_MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Disconnect a tenant WhatsApp Web session' })
  disconnect(
    @Body() dto: TenantSessionDto,
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
  ) {
    const tenantId =
      user.role === UserRole.SUPER_ADMIN ? dto.tenantId : (user.tenantId as string);
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.whatsappSessionsService.disconnectSession(tenantId);
  }

  @Get(':tenantId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.HR_MANAGER,
    UserRole.RECRUITER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get WhatsApp Web session status for a tenant' })
  getStatus(
    @Param('tenantId') paramTenantId: string,
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
  ) {
    const tenantId =
      user.role === UserRole.SUPER_ADMIN ? paramTenantId : (user.tenantId as string);
    return this.whatsappSessionsService.getSession(tenantId);
  }
}
