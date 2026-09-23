import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../users/schemas/user.schema';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async create(dto: CreateSubscriptionDto) {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + dto.durationMonths);

    return this.subscriptionModel.create({
      tenantId: new Types.ObjectId(dto.tenantId),
      planName: dto.planName,
      durationMonths: dto.durationMonths,
      startsAt,
      endsAt,
      maxMonthlyOtp: dto.maxMonthlyOtp,
      price: dto.price,
      currency: dto.currency || 'USD',
      status: 'active',
      notes: dto.notes || '',
    });
  }

  async listForUser(user: { role: UserRole; tenantId: string | null }) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.subscriptionModel.find().sort({ createdAt: -1 }).lean();
    }

    return this.subscriptionModel
      .find({ tenantId: new Types.ObjectId(user.tenantId as string) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async listAll() {
    return this.subscriptionModel.find().sort({ createdAt: -1 }).lean();
  }

  async findActiveByTenant(tenantId: string) {
    const now = new Date();

    return this.subscriptionModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        status: 'active',
        startsAt: { $lte: now },
        endsAt: { $gte: now },
      })
      .sort({ endsAt: -1 });
  }

  async countActiveSubscriptions() {
    const now = new Date();
    return this.subscriptionModel.countDocuments({
      status: 'active',
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    });
  }

  async totalRevenue(tenantId?: string) {
    const filter: Record<string, unknown> = {};
    if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    const rows = await this.subscriptionModel.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);

    return rows[0]?.total || 0;
  }

  async revenueSeries(tenantId?: string) {
    const filter: Record<string, unknown> = {};
    if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    const rows = await this.subscriptionModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$startsAt' },
            month: { $month: '$startsAt' },
          },
          revenue: { $sum: '$price' },
          sales: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return rows.map((row) => ({
      label: `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
      revenue: row.revenue,
      sales: row.sales,
    }));
  }

  async planBreakdown(tenantId?: string) {
    const filter: Record<string, unknown> = {};
    if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    const rows = await this.subscriptionModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$planName',
          count: { $sum: 1 },
          revenue: { $sum: '$price' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 6 },
    ]);

    return rows.map((row) => ({
      plan: row._id,
      count: row.count,
      revenue: row.revenue,
    }));
  }
}
