import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OtpTemplatesDto {
  @ApiPropertyOptional({
    example:
      'رمز تسجيل الدخول الخاص بك هو {{code}}. صالح لمدة {{expiresInMinutes}} دقيقة.',
  })
  @IsOptional()
  @IsString()
  login?: string;

  @ApiPropertyOptional({
    example:
      'رمز تأكيد إنشاء الحساب هو {{code}}. صالح لمدة {{expiresInMinutes}} دقيقة.',
  })
  @IsOptional()
  @IsString()
  register?: string;

  @ApiPropertyOptional({
    example:
      'رمز إعادة تعيين كلمة المرور هو {{code}}. صالح لمدة {{expiresInMinutes}} دقيقة.',
  })
  @IsOptional()
  @IsString()
  forgotPassword?: string;
}

export class UpdateOtpSettingsDto {
  @ApiPropertyOptional({ type: OtpTemplatesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OtpTemplatesDto)
  templates?: OtpTemplatesDto;
}
