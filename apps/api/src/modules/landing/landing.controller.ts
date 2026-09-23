import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { CreateLandingOrderDto } from './dto/create-landing-order.dto';
import { UpdateLandingOrderStatusDto } from './dto/update-landing-order-status.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { LandingService } from './landing.service';
import { LandingOrderStatus } from './schemas/landing-order.schema';

@ApiTags('Landing')
@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get('public')
  @ApiOperation({ summary: 'Public landing page content' })
  publicPage() {
    return this.landingService.getPublicPage();
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create a public landing page order' })
  createOrder(@Body() dto: CreateLandingOrderDto) {
    return this.landingService.createOrder(dto);
  }

  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Landing page content for admin editing' })
  adminPage() {
    return this.landingService.getAdminPage();
  }

  @Patch('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update landing page content' })
  update(@Body() dto: UpdateLandingPageDto) {
    return this.landingService.updatePage(dto);
  }

  @Get('admin/orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List landing page orders' })
  orders(@Query('status') status?: LandingOrderStatus) {
    return this.landingService.listOrders(status);
  }

  @Patch('admin/orders/:orderId/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update landing page order status' })
  updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateLandingOrderStatusDto,
  ) {
    return this.landingService.updateOrderStatus(orderId, dto);
  }
}
