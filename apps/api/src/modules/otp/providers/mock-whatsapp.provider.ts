import { Injectable } from '@nestjs/common';
import { ProviderType } from '../../providers/schemas/provider-account.schema';
import {
  ProviderSendResult,
  SendOtpPayload,
  WhatsappProvider,
} from './whatsapp-provider.interface';

@Injectable()
export class MockWhatsappProvider implements WhatsappProvider {
  readonly type = ProviderType.MOCK;

  async sendOtp(payload: SendOtpPayload): Promise<ProviderSendResult> {
    console.log(
      `[mock-whatsapp] sending OTP "${payload.messageBody}" to ${payload.phoneNumber} for ${payload.purpose}`,
    );

    return {
      providerType: ProviderType.MOCK,
      providerMessageId: `mock_${Date.now()}`,
      debugCode: payload.code,
    };
  }
}
