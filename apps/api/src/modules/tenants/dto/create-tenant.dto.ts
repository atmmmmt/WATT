import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsObject,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TenantProduct } from '../schemas/tenant.schema';

class CreateTenantOtpTemplatesDto {
  @ApiPropertyOptional({
    example:
      'رمز تسجيل الدخول الخاص بك هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  })
  @IsOptional()
  @IsString()
  login?: string;

  @ApiPropertyOptional({
    example:
      'رمز تأكيد إنشاء الحساب هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  })
  @IsOptional()
  @IsString()
  register?: string;

  @ApiPropertyOptional({
    example:
      'رمز إعادة تعيين كلمة المرور هو {{code}}. هذا الرمز صالح لمدة {{expiresInMinutes}} دقيقة.',
  })
  @IsOptional()
  @IsString()
  forgotPassword?: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme LLC' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'acme-llc' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug: string;

  @ApiProperty({ example: 'ops@acme.com' })
  @IsEmail()
  contactEmail: string;

  @ApiPropertyOptional({ type: [String], example: ['https://app.acme.com'] })
  @IsArray()
  @IsOptional()
  allowedOrigins?: string[];

  @ApiPropertyOptional({
    enum: TenantProduct,
    isArray: true,
    example: [TenantProduct.OTP, TenantProduct.HR],
  })
  @IsArray()
  @IsEnum(TenantProduct, { each: true })
  @IsOptional()
  enabledProducts?: TenantProduct[];

  @ApiPropertyOptional({ example: 'Acme Admin' })
  @IsOptional()
  @IsString()
  adminName?: string;

  @ApiPropertyOptional({ example: 'admin@acme.com' })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional({ example: 'SecurePass123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  @ApiPropertyOptional({ type: CreateTenantOtpTemplatesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateTenantOtpTemplatesDto)
  otpTemplates?: CreateTenantOtpTemplatesDto;
}
