import { Injectable } from '@nestjs/common';
import { ProviderType } from '../../providers/schemas/provider-account.schema';
import { WhatsappSessionsService } from '../../whatsapp-sessions/whatsapp-sessions.service';
import {
  ProviderSendResult,
  SendOtpPayload,
  WhatsappProvider,
} from './whatsapp-provider.interface';

@Injectable()
export class WhatsappWebProvider implements WhatsappProvider {
  readonly type = ProviderType.WHATSAPP_WEB;

  constructor(
    private readonly whatsappSessionsService: WhatsappSessionsService,
  ) {}

  async sendOtp(payload: SendOtpPayload): Promise<ProviderSendResult> {
    const result = await this.whatsappSessionsService.sendTextMessage(
      payload.tenantId,
      payload.phoneNumber,
      payload.messageBody,
    );

    return result;
  }
}
