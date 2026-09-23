import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type AgentOnlineSessionDocument = HydratedDocument<AgentOnlineSession>;

@Schema({ timestamps: true, collection: 'agent_online_sessions' })
export class AgentOnlineSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  loginAt: Date;

  @Prop({ type: Date, default: null })
  logoutAt: Date | null;

  @Prop({ type: Number, default: null })
  durationMinutes: number | null;

  @Prop({ type: String, default: null })
  socketId: string | null;
}

export const AgentOnlineSessionSchema = SchemaFactory.createForClass(AgentOnlineSession);
