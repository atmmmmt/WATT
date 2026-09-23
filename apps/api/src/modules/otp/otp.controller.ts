import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenantContext } from '../../common/decorators/current-tenant-context.decorator';
import { Products } from '../../common/decorators/products.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProductGuard } from '../../common/guards/product.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantProduct } from '../tenants/schemas/tenant.schema';
import { TenantContext } from '../api-keys/api-keys.service';
import { UserRole } from '../users/schemas/user.schema';
import { SendOtpDto } from './dto/send-otp.dto';
import { UpdateOtpSettingsDto } from './dto/update-otp-settings.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

@ApiTags('OTP')
@Controller()
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('v1/otp/send')
  @UseGuards(ApiKeyGuard, ProductGuard)
  @Products(TenantProduct.OTP)
  @ApiSecurity('tenantApiKey')
  @ApiOperation({ summary: 'Tenant-facing OTP send endpoint' })
  sendOtp(
    @Body() dto: SendOtpDto,
    @CurrentTenantContext() tenantContext: TenantContext,
  ) {
    return this.otpService.sendOtp(tenantContext, dto);
  }

  @Post('v1/otp/verify')
  @UseGuards(ApiKeyGuard, ProductGuard)
  @Products(TenantProduct.OTP)
  @ApiSecurity('tenantApiKey')
  @ApiOperation({ summary: 'Tenant-facing OTP verify endpoint' })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentTenantContext() tenantContext: TenantContext,
  ) {
    return this.otpService.verifyOtp(tenantContext, dto);
  }

  @Get('otp/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get OTP message template settings for a tenant' })
  getSettings(
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId =
      user.role === UserRole.TENANT_ADMIN ? (user.tenantId as string) : tenantId;

    if (!effectiveTenantId) {
      throw new BadRequestException('tenantId is required');
    }

    return this.otpService.getSettings(effectiveTenantId);
  }

  @Post('otp/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update OTP message template settings for a tenant' })
  updateSettings(
    @Body() dto: UpdateOtpSettingsDto,
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId =
      user.role === UserRole.TENANT_ADMIN ? (user.tenantId as string) : tenantId;

    if (!effectiveTenantId) {
      throw new BadRequestException('tenantId is required');
    }

    return this.otpService.updateSettings(effectiveTenantId, dto);
  }

  @Get('otp-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Dashboard OTP request logs' })
  listRequests(
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId =
      user.role === UserRole.TENANT_ADMIN ? (user.tenantId as string) : tenantId;

    return this.otpService.listRequests(effectiveTenantId);
  }
}
