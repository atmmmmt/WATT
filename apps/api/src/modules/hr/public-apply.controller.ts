import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplyHrJobDto } from './dto/apply-hr-job.dto';
import { HrService } from './hr.service';

@ApiTags('Public HR Apply')
@Controller('apply')
export class PublicApplyController {
  constructor(private readonly hrService: HrService) {}

  @Get(':jobSlug')
  @ApiOperation({ summary: 'Get public job details' })
  getJob(@Param('jobSlug') jobSlug: string) {
    return this.hrService.getPublicJob(jobSlug);
  }

  @Post(':jobSlug')
  @ApiOperation({ summary: 'Apply to a public job' })
  apply(@Param('jobSlug') jobSlug: string, @Body() dto: ApplyHrJobDto) {
    return this.hrService.applyToJob(jobSlug, dto);
  }
}
