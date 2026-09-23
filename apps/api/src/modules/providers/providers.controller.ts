import {
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { UpsertProviderDto } from './dto/upsert-provider.dto';
import { ProvidersService } from './providers.service';

@ApiTags('Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Create or update a tenant WhatsApp provider' })
  async upsert(
    @Body() dto: UpsertProviderDto,
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
  ) {
    if (user.role === UserRole.TENANT_ADMIN && user.tenantId !== dto.tenantId) {
      dto.tenantId = user.tenantId as string;
    }

    return this.providersService.upsertForTenant(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiQuery({ name: 'tenantId', required: false })
  list(
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Query('tenantId') tenantId?: string,
  ) {
    if (user.role === UserRole.TENANT_ADMIN) {
      return this.providersService.listForTenant(user.tenantId as string);
    }

    if (tenantId) {
      return this.providersService.listForTenant(tenantId);
    }

    return this.providersService.listAll();
  }
}
