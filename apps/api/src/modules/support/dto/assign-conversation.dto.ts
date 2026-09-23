import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignConversationDto {
  @ApiProperty()
  @IsString()
  assignedToUserId: string;
}
