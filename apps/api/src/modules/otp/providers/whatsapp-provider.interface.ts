import { ProviderType } from '../../providers/schemas/provider-account.schema';

export interface SendOtpPayload {
  tenantId: string;
  phoneNumber: string;
  code: string;
  expiresInMinutes: number;
  purpose: string;
  messageBody: string;
  config: Record<string, unknown>;
}

export interface ProviderSendResult {
  providerType: ProviderType;
  providerMessageId?: string;
  debugCode?: string;
}

export interface WhatsappProvider {
  readonly type: ProviderType;
  sendOtp(payload: SendOtpPayload): Promise<ProviderSendResult>;
}
