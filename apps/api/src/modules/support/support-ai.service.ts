import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { Model, Types } from 'mongoose';
import {
  SupportMessage,
  SupportMessageDocument,
  SupportMessageDirection,
} from './schemas/support-message.schema';
import {
  SupportQuickReply,
  SupportQuickReplyDocument,
} from './schemas/support-quick-reply.schema';

const AI_MODEL = process.env.SUPPORT_AI_MODEL || 'claude-opus-5';
const HISTORY_LIMIT = 20;

export interface AiReplyInput {
  companyName: string;
  instructions: string;
  knowledgeBase: string;
  history: Array<{ direction: string; body: string; messageType?: string }>;
}

export type AiReplyResult =
  | { action: 'reply'; message: string }
  | { action: 'handoff'; reason: string };

/** Thrown for failures that should surface as "AI Failed" with a readable reason. */
export class SupportAiError extends Error {}

@Injectable()
export class SupportAiService {
  private readonly logger = new Logger(SupportAiService.name);
  private client: Anthropic | null = null;

  constructor(
    @InjectModel(SupportMessage.name)
    private readonly messageModel: Model<SupportMessageDocument>,
    @InjectModel(SupportQuickReply.name)
    private readonly quickReplyModel: Model<SupportQuickReplyDocument>,
  ) {}

  /** The SDK also accepts other credential sources, but a server deploy needs an explicit key. */
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  private getClient() {
    if (!this.isConfigured()) {
      throw new SupportAiError('ANTHROPIC_API_KEY غير مضبوط على السيرفر');
    }
    this.client ??= new Anthropic();
    return this.client;
  }

  async loadHistory(companyId: Types.ObjectId, conversationId: Types.ObjectId) {
    const recent = await this.messageModel
      .find({ companyId, conversationId }, { direction: 1, body: 1, messageType: 1 })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();
    return recent.reverse();
  }

  /**
   * Decides whether to answer the customer or hand the conversation to a human. The
   * model only sees the company's own instructions and knowledge base; anything it
   * cannot answer from them becomes a handoff rather than a guess.
   */
  async generateReply(input: AiReplyInput): Promise<AiReplyResult> {
    const client = this.getClient();

    const system = [
      `You are the WhatsApp customer-support assistant for "${input.companyName}".`,
      'Reply in the same language and dialect the customer uses. Keep replies short and friendly, suitable for WhatsApp.',
      'Answer ONLY from the knowledge base and instructions below. If the answer is not there, if the customer asks for a human, or if the request needs an action you cannot take (refunds, account changes, complaints), choose "handoff" instead of guessing.',
      'Never invent prices, dates, policies, or contact details.',
      input.instructions ? `<company_instructions>\n${input.instructions}\n</company_instructions>` : '',
      `<knowledge_base>\n${input.knowledgeBase || '(empty)'}\n</knowledge_base>`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const transcript = input.history
      .map((m) => {
        const who = m.direction === SupportMessageDirection.INCOMING ? 'Customer' : 'Support';
        const body = m.body?.trim() || `[${m.messageType || 'media'}]`;
        return `${who}: ${body}`;
      })
      .join('\n');

    let response: Anthropic.Beta.Messages.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: AI_MODEL,
        max_tokens: 2048,
        // Server-side fallback: if the primary model declines, the API retries on a
        // suitable fallback model instead of returning an empty refusal.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['reply', 'handoff'] },
                message: { type: 'string', description: 'The WhatsApp reply to send (empty for handoff)' },
                reason: { type: 'string', description: 'Why a human is needed (empty for reply)' },
              },
              required: ['action', 'message', 'reason'],
              additionalProperties: false,
            },
          },
        },
        system,
        messages: [
          {
            role: 'user',
            content: `Conversation so far (oldest first):\n${transcript}\n\nDecide how to respond to the customer's latest message.`,
          },
        ],
      } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
    } catch (error) {
      throw new SupportAiError(this.describeApiError(error));
    }

    if (response.stop_reason === 'refusal') {
      return { action: 'handoff', reason: 'رفض النموذج الرد على هذه الرسالة' };
    }
    if (response.stop_reason === 'max_tokens') {
      throw new SupportAiError('انقطع رد الذكاء الاصطناعي قبل اكتماله (max_tokens)');
    }

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    let parsed: { action?: string; message?: string; reason?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SupportAiError('رد الذكاء الاصطناعي ليس بالصيغة المتوقعة');
    }

    if (parsed.action === 'reply' && parsed.message?.trim()) {
      return { action: 'reply', message: parsed.message.trim() };
    }
    return { action: 'handoff', reason: parsed.reason?.trim() || 'يحتاج تدخل موظف' };
  }

  private describeApiError(error: unknown) {
    if (error instanceof Anthropic.AuthenticationError) return 'مفتاح Anthropic غير صالح (401)';
    if (error instanceof Anthropic.PermissionDeniedError) return 'المفتاح لا يملك صلاحية لهذا النموذج (403)';
    if (error instanceof Anthropic.NotFoundError) return `النموذج ${AI_MODEL} غير متاح (404)`;
    if (error instanceof Anthropic.RateLimitError) return 'تم تجاوز حد الطلبات لدى Anthropic (429)';
    if (error instanceof Anthropic.BadRequestError) return `طلب غير صالح لـ Anthropic: ${error.message}`;
    if (error instanceof Anthropic.APIConnectionError) return 'تعذر الاتصال بخدمة Anthropic';
    if (error instanceof Anthropic.APIError) return `خطأ من Anthropic (${error.status ?? '?'}): ${error.message}`;
    return error instanceof Error ? error.message : 'خطأ غير معروف في الذكاء الاصطناعي';
  }

  /** Manual "AI assist" panel: summary + suggested replies for the agent to pick from. */
  async generateAssist(conversationId: string, companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    const conversationObjectId = new Types.ObjectId(conversationId);
    const context = await this.loadHistory(companyObjectId, conversationObjectId);
    const lastIncoming = context.filter((m) => m.direction === SupportMessageDirection.INCOMING).pop();
    const quickReplySuggestions = await this.matchQuickReplies(lastIncoming?.body || '', companyObjectId);

    if (!this.isConfigured() || context.length === 0) {
      return {
        summary: context.length === 0
          ? 'لا توجد رسائل لتلخيصها.'
          : 'الذكاء الاصطناعي غير مفعّل على السيرفر — تظهر الردود السريعة المطابقة فقط.',
        suggestions: quickReplySuggestions,
        aiAvailable: this.isConfigured(),
      };
    }

    try {
      const transcript = context
        .map((m) => `${m.direction === SupportMessageDirection.INCOMING ? 'Customer' : 'Support'}: ${m.body || `[${m.messageType}]`}`)
        .join('\n');
      const response = await this.getClient().beta.messages.create({
        model: AI_MODEL,
        max_tokens: 2048,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                suggestions: { type: 'array', items: { type: 'string' } },
              },
              required: ['summary', 'suggestions'],
              additionalProperties: false,
            },
          },
        },
        system:
          'You help a support agent. Summarize the WhatsApp conversation in 1-2 sentences and suggest up to 3 short replies the agent could send. Write in the customer\'s language.',
        messages: [{ role: 'user', content: transcript }],
      } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      const parsed = JSON.parse(text) as { summary: string; suggestions: string[] };
      return {
        summary: parsed.summary,
        suggestions: [...quickReplySuggestions.slice(0, 2), ...parsed.suggestions].slice(0, 5),
        aiAvailable: true,
      };
    } catch (error) {
      const reason = error instanceof SupportAiError ? error.message : this.describeApiError(error);
      this.logger.error(`AI assist failed for conversation ${conversationId}: ${reason}`);
      return { summary: `تعذر توليد الملخص: ${reason}`, suggestions: quickReplySuggestions, aiAvailable: true };
    }
  }

  private async matchQuickReplies(lastMessageBody: string, companyId: Types.ObjectId) {
    const text = lastMessageBody.toLowerCase();
    const quickReplies = await this.quickReplyModel.find({ companyId, isActive: true }).lean();
    return quickReplies
      .filter((qr) => qr.title.toLowerCase().split(' ').some((k) => k.length > 3 && text.includes(k)))
      .map((qr) => qr.message);
  }
}
