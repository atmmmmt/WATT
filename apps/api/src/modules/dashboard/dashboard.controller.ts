import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { DashboardService } from './dashboard.service';
import { DashboardTestSendDto } from './dto/dashboard-test-send.dto';
import { DashboardTestVerifyDto } from './dto/dashboard-test-verify.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Dashboard summary widgets' })
  summary(@CurrentUser() user: { role: UserRole; tenantId: string | null }) {
    return this.dashboardService.summary(user);
  }

  @Get('workspace')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get the full command-center payload' })
  workspace(
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Query('tenantId') tenantId?: string,
  ) {
    return this.dashboardService.workspace(user, tenantId);
  }

  @Post('test/send')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Send a test OTP directly from the dashboard' })
  sendTestOtp(
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Body() dto: DashboardTestSendDto,
  ) {
    return this.dashboardService.sendTestOtp(user, dto);
  }

  @Post('test/verify')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Verify a test OTP directly from the dashboard' })
  verifyTestOtp(
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Body() dto: DashboardTestVerifyDto,
  ) {
    return this.dashboardService.verifyTestOtp(user, dto);
  }
}
