import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SupportConversationStatus } from '../schemas/support-conversation.schema';

export class UpdateConversationStatusDto {
  @ApiProperty({ enum: SupportConversationStatus })
  @IsEnum(SupportConversationStatus)
  status: SupportConversationStatus;
}
