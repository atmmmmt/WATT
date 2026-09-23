import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ProviderType } from '../../providers/schemas/provider-account.schema';
import {
  ProviderSendResult,
  SendOtpPayload,
  WhatsappProvider,
} from './whatsapp-provider.interface';

@Injectable()
export class TwilioWhatsappProvider implements WhatsappProvider {
  readonly type = ProviderType.TWILIO;

  async sendOtp(payload: SendOtpPayload): Promise<ProviderSendResult> {
    const accountSid = String(payload.config.accountSid || '');
    const authToken = String(payload.config.authToken || '');
    const fromNumber = String(payload.config.fromNumber || '');

    if (!accountSid || !authToken || !fromNumber) {
      throw new InternalServerErrorException(
        'Twilio provider is missing accountSid, authToken, or fromNumber',
      );
    }

    const body = new URLSearchParams();
    body.set('From', `whatsapp:${fromNumber}`);
    body.set('To', `whatsapp:${payload.phoneNumber}`);
    body.set('Body', payload.messageBody);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(
        `Twilio WhatsApp send failed: ${text}`,
      );
    }

    const result = (await response.json()) as { sid: string };
    return {
      providerType: ProviderType.TWILIO,
      providerMessageId: result.sid,
    };
  }
}
