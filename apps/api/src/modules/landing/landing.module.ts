import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LandingController } from './landing.controller';
import { LandingService } from './landing.service';
import { LandingPage, LandingPageSchema } from './schemas/landing-page.schema';
import { LandingOrder, LandingOrderSchema } from './schemas/landing-order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LandingPage.name, schema: LandingPageSchema },
      { name: LandingOrder.name, schema: LandingOrderSchema },
    ]),
  ],
  controllers: [LandingController],
  providers: [LandingService],
})
export class LandingModule {}
