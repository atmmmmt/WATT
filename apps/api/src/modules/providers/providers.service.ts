import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProviderAccount,
  ProviderAccountDocument,
  ProviderType,
} from './schemas/provider-account.schema';
import { UpsertProviderDto } from './dto/upsert-provider.dto';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectModel(ProviderAccount.name)
    private readonly providerModel: Model<ProviderAccountDocument>,
  ) {}

  async upsertForTenant(dto: UpsertProviderDto) {
    const tenantObjectId = new Types.ObjectId(dto.tenantId);

    return this.providerModel.findOneAndUpdate(
      { tenantId: tenantObjectId },
      {
        tenantId: tenantObjectId,
        providerType: dto.providerType,
        status: dto.status || 'active',
        config: dto.config || {},
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async getActiveProviderForTenant(tenantId: string) {
    const provider = await this.providerModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        status: 'active',
      })
      .lean();

    if (provider) {
      return provider;
    }

    return {
      tenantId,
      providerType: ProviderType.MOCK,
      status: 'active',
      config: {},
    };
  }

  async listForTenant(tenantId: string) {
    return this.providerModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ updatedAt: -1 })
      .lean();
  }

  async listAll() {
    return this.providerModel.find().sort({ updatedAt: -1 }).lean();
  }
}
