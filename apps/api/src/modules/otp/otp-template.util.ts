export type OtpTemplateKey = 'login' | 'register' | 'forgotPassword';

export interface OtpTemplateOverrides {
  login?: string;
  register?: string;
  forgotPassword?: string;
}

export const OTP_TEMPLATE_LABELS: Record<OtpTemplateKey, string> = {
  login: 'تسجيل الدخول',
  register: 'تأكيد إنشاء الحساب',
  forgotPassword: 'إعادة تعيين كلمة المرور',
};

export const DEFAULT_OTP_TEMPLATES: Record<OtpTemplateKey, string> = {
  login:
    'رمز تسجيل الدخول الخاص بك هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  register:
    'رمز تأكيد إنشاء الحساب هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  forgotPassword:
    'رمز إعادة تعيين كلمة المرور هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
};

export const OTP_REQUIRED_PLACEHOLDER = '{{code}}';
export const OTP_OPTIONAL_PLACEHOLDERS = ['{{expiresInMinutes}}'];

export function resolveOtpTemplateKey(purpose?: string): OtpTemplateKey {
  const normalized = String(purpose || 'login')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'register':
    case 'signup':
    case 'sign_up':
    case 'create_account':
    case 'account_create':
      return 'register';
    case 'forgot_password':
    case 'forget_password':
    case 'reset_password':
    case 'password_reset':
    case 'forgot':
    case 'reset':
      return 'forgotPassword';
    case 'login':
    default:
      return 'login';
  }
}

export function getOtpTemplatesFromSettings(
  settings: Record<string, unknown> | null | undefined,
): OtpTemplateOverrides {
  const source =
    settings && typeof settings === 'object'
      ? ((settings.otpTemplates as Record<string, unknown>) || {})
      : {};

  return {
    login:
      typeof source.login === 'string' && source.login.trim()
        ? source.login.trim()
        : undefined,
    register:
      typeof source.register === 'string' && source.register.trim()
        ? source.register.trim()
        : undefined,
    forgotPassword:
      typeof source.forgotPassword === 'string' && source.forgotPassword.trim()
        ? source.forgotPassword.trim()
        : undefined,
  };
}

export function getEffectiveOtpTemplate(
  settings: Record<string, unknown> | null | undefined,
  key: OtpTemplateKey,
) {
  const overrides = getOtpTemplatesFromSettings(settings);
  return overrides[key] || DEFAULT_OTP_TEMPLATES[key];
}

export function renderOtpTemplate(
  template: string,
  variables: Record<string, string | number>,
) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const value = variables[name];
    return value === undefined || value === null ? '' : String(value);
  });
}
