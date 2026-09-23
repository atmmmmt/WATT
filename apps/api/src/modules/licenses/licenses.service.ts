import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomToken } from '../../common/utils/hash.util';
import { UserRole } from '../users/schemas/user.schema';
import { CreateLicenseDto } from './dto/create-license.dto';
import { License, LicenseDocument } from './schemas/license.schema';

@Injectable()
export class LicensesService {
  constructor(
    @InjectModel(License.name)
    private readonly licenseModel: Model<LicenseDocument>,
  ) {}

  async create(dto: CreateLicenseDto) {
    const key = `lic_${randomToken(12)}`;

    return this.licenseModel.create({
      tenantId: new Types.ObjectId(dto.tenantId),
      label: dto.label,
      key,
      expiresAt: new Date(dto.expiresAt),
      features: dto.features || ['dashboard', 'api', 'otp'],
      status: 'active',
    });
  }

  async listForUser(user: { role: UserRole; tenantId: string | null }) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.licenseModel.find().sort({ createdAt: -1 }).lean();
    }

    return this.licenseModel
      .find({ tenantId: new Types.ObjectId(user.tenantId as string) })
      .sort({ createdAt: -1 })
      .lean();
  }
}
