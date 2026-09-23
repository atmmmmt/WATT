import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class DashboardTestVerifyDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ example: '+966501234567' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/)
  phoneNumber: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({ example: 'login' })
  @IsOptional()
  @IsString()
  purpose?: string;
}
