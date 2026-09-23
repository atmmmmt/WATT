import {
  Body,
  Controller,
  Get,
  Query,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeysService } from './api-keys.service';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Create a tenant API key and export setup package' })
  create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
  ) {
    if (user.role === UserRole.TENANT_ADMIN) {
      dto.tenantId = user.tenantId as string;
    }

    return this.apiKeysService.createKey(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiQuery({ name: 'tenantId', required: false })
  list(
    @CurrentUser() user: { role: UserRole; tenantId: string | null },
    @Query('tenantId') tenantId?: string,
  ) {
    if (user.role === UserRole.TENANT_ADMIN) {
      return this.apiKeysService.listForTenant(user.tenantId as string);
    }

    if (tenantId) {
      return this.apiKeysService.listForTenant(tenantId);
    }

    return this.apiKeysService.listAll();
  }
}
