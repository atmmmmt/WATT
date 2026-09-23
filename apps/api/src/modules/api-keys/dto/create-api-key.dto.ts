import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ example: 'Production API Key' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ type: [String], example: ['otp:send', 'otp:verify'] })
  @IsOptional()
  @IsArray()
  scopes?: string[];
}
