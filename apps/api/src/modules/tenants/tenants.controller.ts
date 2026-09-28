import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantProductsDto } from './dto/update-tenant-products.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a tenant and optional tenant admin user' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  list(@CurrentUser() user: { role: UserRole; tenantId: string | null }) {
    return this.tenantsService.listForUser(user);
  }

  @Patch(':tenantId/products')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Enable or disable tenant products' })
  updateProducts(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantProductsDto,
  ) {
    return this.tenantsService.updateProducts(tenantId, dto.enabledProducts);
  }

  @Post(':tenantId/send-password-reset')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send a password reset email to the tenant administrator' })
  sendPasswordReset(@Param('tenantId') tenantId: string) {
    return this.tenantsService.sendPasswordReset(tenantId);
  }

  @Delete(':tenantId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a tenant and all related tenant data' })
  remove(@Param('tenantId') tenantId: string) {
    return this.tenantsService.deleteTenant(tenantId);
  }

  @Get(':tenantId/setup-package')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Export setup metadata for a tenant integration' })
  exportSetupPackage(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
  ) {
    const effectiveTenantId =
      user.role === UserRole.TENANT_ADMIN ? (user.tenantId as string) : tenantId;
    return this.tenantsService.buildSetupPackage(effectiveTenantId);
  }
}
