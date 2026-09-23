import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListConversationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['all', 'assigned_to_me', 'unassigned'] })
  @IsOptional()
  @IsIn(['all', 'assigned_to_me', 'unassigned'])
  filter?: 'all' | 'assigned_to_me' | 'unassigned';

  @ApiPropertyOptional({ enum: ['open', 'pending', 'closed'] })
  @IsOptional()
  @IsIn(['open', 'pending', 'closed'])
  status?: 'open' | 'pending' | 'closed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;
}
