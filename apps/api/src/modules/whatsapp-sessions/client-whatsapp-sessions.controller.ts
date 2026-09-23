import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';
import { CurrentTenantContext } from '../../common/decorators/current-tenant-context.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TenantContext } from '../api-keys/api-keys.service';
import { WhatsappSessionsService } from './whatsapp-sessions.service';

class SendWhatsappMessageDto {
  @ApiProperty({ example: '+963XXXXXXXXX' })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({ example: 'نص الرسالة' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

@ApiTags('Client WhatsApp Session')
@Controller('v1/whatsapp/session')
export class ClientWhatsappSessionsController {
  constructor(
    private readonly whatsappSessionsService: WhatsappSessionsService,
  ) {}

  @Get('status')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('tenantApiKey')
  @ApiOperation({
    summary:
      'Get the WhatsApp connection status for the current tenant, including qrDataUrl when a QR is ready',
  })
  status(@CurrentTenantContext() tenantContext: TenantContext) {
    return this.whatsappSessionsService.getClientSessionStatus(
      tenantContext.tenantId,
    );
  }

  @Post('start')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('tenantApiKey')
  @ApiOperation({
    summary:
      'Start or resume a WhatsApp Web QR session for the current tenant',
  })
  start(@CurrentTenantContext() tenantContext: TenantContext) {
    return this.whatsappSessionsService.startSession(tenantContext.tenantId);
  }

  @Post('disconnect')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('tenantApiKey')
  @ApiOperation({
    summary:
      'Disconnect the current tenant WhatsApp Web session and clear the QR-ready state',
  })
  disconnect(@CurrentTenantContext() tenantContext: TenantContext) {
    return this.whatsappSessionsService.disconnectSession(
      tenantContext.tenantId,
    );
  }

}
