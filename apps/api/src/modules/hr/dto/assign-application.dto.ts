import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class AssignApplicationDto {
  @ApiProperty()
  @IsMongoId()
  assignedToUserId: string;
}
