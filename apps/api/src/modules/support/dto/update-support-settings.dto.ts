import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSupportSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowAgentClaimUnassigned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowAgentViewUnassigned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowSupervisorViewAll?: boolean;

  @ApiPropertyOptional({ description: 'AI auto-reply on incoming customer messages' })
  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Stop AI once staff reply to or take a conversation' })
  @IsOptional()
  @IsBoolean()
  aiPauseOnHumanTakeover?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  aiInstructions?: string;

  @ApiPropertyOptional({ description: 'Company knowledge base the AI answers from' })
  @IsOptional()
  @IsString()
  @MaxLength(60000)
  aiKnowledgeBase?: string;
}
