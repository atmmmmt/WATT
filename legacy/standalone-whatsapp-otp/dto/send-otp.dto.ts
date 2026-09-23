import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'Phone number to send OTP to',
    example: '+966501234567',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in international format',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Purpose of OTP (login, register, reset-password, etc.)',
    example: 'login',
    required: false,
  })
  @IsString()
  @IsOptional()
  purpose?: string;
}

