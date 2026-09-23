import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupportPermission } from '../../common/utils/support-permissions.util';
import { UserRole } from '../users/schemas/user.schema';
import { SupportService, SupportUserContext } from './support.service';

@ApiTags('Support Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, CompanyAccessGuard)
@Controller('api/reports')
export class SupportReportsController {
  constructor(private readonly supportService: SupportService) {}

  @Get('support-summary')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
  )
  @Permissions(SupportPermission.REPORTS_VIEW)
  @ApiOperation({ summary: 'Support inbox KPI summary' })
  supportSummary(
    @CurrentUser() user: SupportUserContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.supportService.reportSummary(user, from, to, companyId);
  }

  @Get('agent-stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.TENANT_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
  )
  @Permissions(SupportPermission.REPORTS_VIEW)
  @ApiOperation({ summary: 'Per-agent performance stats including online hours' })
  agentStats(
    @CurrentUser() user: SupportUserContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.supportService.agentStats(user, from, to, companyId);
  }
}
