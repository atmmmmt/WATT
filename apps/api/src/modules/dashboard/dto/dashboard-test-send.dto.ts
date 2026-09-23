import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class DashboardTestSendDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ example: '+966501234567' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/)
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'login' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
