import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProviderAccount,
  ProviderAccountSchema,
} from './schemas/provider-account.schema';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProviderAccount.name, schema: ProviderAccountSchema },
    ]),
  ],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService, MongooseModule],
})
export class ProvidersModule {}
