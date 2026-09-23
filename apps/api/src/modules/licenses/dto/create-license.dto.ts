import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateLicenseDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ example: 'Acme Production License' })
  @IsString()
  label: string;

  @ApiProperty({ example: '2030-12-31T23:59:59.000Z' })
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional({ type: [String], example: ['dashboard', 'api', 'otp'] })
  @IsOptional()
  @IsArray()
  features?: string[];
}
