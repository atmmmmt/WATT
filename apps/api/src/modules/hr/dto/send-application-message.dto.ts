import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class SendApplicationMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
