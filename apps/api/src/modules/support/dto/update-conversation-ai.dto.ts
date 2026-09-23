import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateConversationAiDto {
  @ApiProperty({ enum: ['active', 'paused'] })
  @IsIn(['active', 'paused'])
  status: 'active' | 'paused';
}
