import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { mergePermissions } from '../../common/utils/support-permissions.util';
import { mergeDoctorRelayPermissions } from '../../common/utils/doctor-relay-permissions.util';
import { randomToken } from '../../common/utils/hash.util';

interface CreateUserInput {
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  tenantId?: string | null;
  phone?: string;
  permissions?: string[];
  withInvite?: boolean;
}

interface UpdateUserInput {
  email?: string;
  name?: string;
  phone?: string;
  role?: UserRole;
  permissions?: string[];
  status?: 'active' | 'inactive';
  password?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async createUser(input: CreateUserInput) {
    const { user } = await this._createUserInternal(input);
    return user;
  }

  async createUserForInvite(input: Omit<CreateUserInput, 'password' | 'withInvite'>) {
    return this._createUserInternal({ ...input, withInvite: true });
  }

  private async _createUserInternal(input: CreateUserInput) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).lean();

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    let passwordHash: string;
    let inviteToken: string | null = null;
    let inviteTokenExpiresAt: Date | null = null;

    if (input.withInvite || !input.password) {
      passwordHash = await bcrypt.hash(randomToken(), 10);
      inviteToken = randomToken();
      inviteTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    } else {
      passwordHash = await bcrypt.hash(input.password, 10);
    }

    const user = await this.userModel.create({
      email,
      passwordHash,
      name: input.name,
      phone: input.phone || '',
      role: input.role,
      permissions: mergePermissions(input.role, input.permissions),
      tenantId: input.tenantId ? new Types.ObjectId(input.tenantId) : null,
      status: inviteToken ? 'inactive' : 'active',
      inviteToken,
      inviteTokenExpiresAt,
    });

    return { user: this.sanitizeUser(user.toObject()), inviteToken };
  }

  async findByInviteToken(token: string) {
    return this.userModel.findOne({
      inviteToken: token,
      inviteTokenExpiresAt: { $gt: new Date() },
    });
  }

  async findByResetToken(token: string) {
    return this.userModel.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() },
    });
  }

  async setPasswordByToken(
    token: string,
    newPassword: string,
    tokenType: 'invite' | 'reset',
  ) {
    const user =
      tokenType === 'invite'
        ? await this.findByInviteToken(token)
        : await this.findByResetToken(token);

    if (!user) {
      throw new BadRequestException('الرابط غير صالح أو منتهي الصلاحية');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.inviteToken = null;
    user.inviteTokenExpiresAt = null;
    user.resetToken = null;
    user.resetTokenExpiresAt = null;
    user.status = 'active';
    await user.save();

    return this.sanitizeUser(user.toObject());
  }

  async generateResetToken(email: string) {
    const user = await this.userModel.findOne({ email: email.trim().toLowerCase() });
    if (!user) return null;

    user.resetToken = randomToken();
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    return { user: this.sanitizeUser(user.toObject()), resetToken: user.resetToken };
  }

  async ensureSuperAdmin(email: string, password: string, name: string) {
    const existing = await this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .lean();

    if (existing) {
      return this.sanitizeUser(existing);
    }

    return this.createUser({
      email,
      password,
      name,
      role: UserRole.SUPER_ADMIN,
    });
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.trim().toLowerCase() });
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async findByIdDocument(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async countUsers() {
    return this.userModel.countDocuments();
  }

  async listForTenant(tenantId: string) {
    const users = await this.userModel
      .find({ tenantId: new Types.ObjectId(tenantId), status: 'active' })
      .sort({ createdAt: -1 })
      .lean();

    return users.map((user) => this.sanitizeUser(user));
  }

  async listAllForTenant(tenantId: string) {
    const users = await this.userModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .lean();

    return users.map((user) => this.sanitizeUser(user));
  }

  async findPrimaryTenantAdmin(tenantId: string) {
    const user = await this.userModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        role: UserRole.TENANT_ADMIN,
        status: 'active',
      })
      .sort({ createdAt: 1 })
      .lean();

    return user ? this.sanitizeUser(user) : null;
  }

  async deleteUser(userId: string) {
    await this.userModel.findByIdAndDelete(userId);
  }

  async updateUser(userId: string, input: UpdateUserInput) {
    const user = await this.findByIdDocument(userId);

    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      const existing = await this.userModel.findOne({
        email,
        _id: { $ne: user._id },
      });

      if (existing) {
        throw new ConflictException('A user with this email already exists');
      }

      user.email = email;
    }

    if (input.name !== undefined) {
      user.name = input.name;
    }

    if (input.phone !== undefined) {
      user.phone = input.phone;
    }

    if (input.role !== undefined) {
      user.role = input.role;
      user.permissions = mergePermissions(
        input.role,
        input.permissions !== undefined ? input.permissions : user.permissions,
      );
    } else if (input.permissions !== undefined) {
      user.permissions = mergePermissions(user.role, input.permissions);
    }

    if (input.status !== undefined) {
      user.status = input.status;
    }

    if (input.password) {
      user.passwordHash = await bcrypt.hash(input.password, 10);
    }

    await user.save();
    return this.sanitizeUser(user.toObject());
  }

  async recordLogin(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      lastLoginAt: new Date(),
    });
  }

  sanitizeUser(user: {
    _id?: Types.ObjectId;
    id?: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    permissions?: string[];
    tenantId?: Types.ObjectId | string | null;
    status?: string;
    lastLoginAt?: Date | string | null;
  }) {
    return {
      id: user._id?.toString() || user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      // Effective permissions across products — the dashboard gates buttons on this
      // exact list, so it must match what the backend guards check.
      permissions: Array.from(
        new Set([
          ...mergePermissions(user.role, user.permissions),
          ...mergeDoctorRelayPermissions(user.role, user.permissions),
        ]),
      ),
      tenantId:
        typeof user.tenantId === 'string'
          ? user.tenantId
          : user.tenantId?.toString() || null,
      status: user.status || 'active',
      lastLoginAt: user.lastLoginAt || null,
    };
  }
}
