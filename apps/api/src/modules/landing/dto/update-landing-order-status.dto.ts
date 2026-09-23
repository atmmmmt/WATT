import { IsEnum } from 'class-validator';
import { LandingOrderStatus } from '../schemas/landing-order.schema';

export class UpdateLandingOrderStatusDto {
  @IsEnum(LandingOrderStatus)
  status: LandingOrderStatus;
}
