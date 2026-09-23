import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  HR_MANAGER = 'hr_manager',
  RECRUITER = 'recruiter',
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  AGENT = 'agent',
}

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ required: true, enum: Object.values(UserRole) })
  role: UserRole;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Tenant', default: null })
  tenantId: Types.ObjectId | null;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: 'active' | 'inactive';

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  @Prop({ type: String, default: null })
  inviteToken: string | null;

  @Prop({ type: Date, default: null })
  inviteTokenExpiresAt: Date | null;

  @Prop({ type: String, default: null })
  resetToken: string | null;

  @Prop({ type: Date, default: null })
  resetTokenExpiresAt: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
