import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { HrApplicationStage } from '../schemas/hr-application.schema';

export class UpdateApplicationStageDto {
  @ApiProperty({ enum: HrApplicationStage })
  @IsEnum(HrApplicationStage)
  stage: HrApplicationStage;
}
