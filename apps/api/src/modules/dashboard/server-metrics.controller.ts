import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { ServerMetricsService } from './server-metrics.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard/server')
export class ServerMetricsController {
  constructor(private readonly serverMetricsService: ServerMetricsService) {}

  @Get('metrics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Read host resource metrics for the platform server' })
  metrics() {
    return this.serverMetricsService.getMetrics();
  }
}
