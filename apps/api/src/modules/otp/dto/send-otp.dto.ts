import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+966501234567' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'Phone number must be in international format',
  })
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'login' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ type: Object, example: { customerId: '1234' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
