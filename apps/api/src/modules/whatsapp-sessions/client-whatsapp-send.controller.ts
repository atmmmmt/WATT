import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CurrentTenantContext } from '../../common/decorators/current-tenant-context.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TenantContext } from '../api-keys/api-keys.service';
import { WhatsappSessionsService } from './whatsapp-sessions.service';

class SendWhatsappMessageDto {
  @ApiProperty({ example: '+963XXXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'نص الرسالة' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

@ApiTags('Client WhatsApp Session')
@Controller('v1/whatsapp')
export class ClientWhatsappSendController {
  constructor(
    private readonly whatsappSessionsService: WhatsappSessionsService,
  ) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('tenantApiKey')
  @ApiOperation({ summary: 'Send a plain WhatsApp text message via the active session' })
  async sendMessage(
    @Body() dto: SendWhatsappMessageDto,
    @CurrentTenantContext() tenantContext: TenantContext,
  ) {
    try {
      await this.whatsappSessionsService.sendTextMessage(
        tenantContext.tenantId,
        dto.phoneNumber,
        dto.message,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  }
}
