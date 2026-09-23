import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupportPermission } from '../../common/utils/support-permissions.util';
import { UserRole } from '../users/schemas/user.schema';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { CreateSupportEmployeeDto } from './dto/create-support-employee.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { UpdateConversationTagsDto } from './dto/update-conversation-tags.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';
import { UpdateSupportEmployeeDto } from './dto/update-support-employee.dto';
import { UpdateSupportSettingsDto } from './dto/update-support-settings.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateConversationAiDto } from './dto/update-conversation-ai.dto';
import { SupportService, SupportUserContext } from './support.service';
import { SupportAiService } from './support-ai.service';

const SUPPORT_USERS = [
  UserRole.SUPER_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.AGENT,
];

@ApiTags('Support Inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, CompanyAccessGuard)
@Controller('api')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly supportAiService: SupportAiService,
  ) {}

  @Get('employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  @Permissions(SupportPermission.EMPLOYEES_MANAGE)
  @ApiOperation({ summary: 'List support employees for a company' })
  listEmployees(
    @CurrentUser() user: SupportUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.supportService.listEmployees(user, companyId);
  }

  @Post('employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  @Permissions(SupportPermission.EMPLOYEES_MANAGE)
  createEmployee(
    @CurrentUser() user: SupportUserContext,
    @Body() dto: CreateSupportEmployeeDto,
  ) {
    return this.supportService.createEmployee(user, dto);
  }

  @Patch('employees/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  @Permissions(SupportPermission.EMPLOYEES_MANAGE)
  updateEmployee(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateSupportEmployeeDto,
  ) {
    return this.supportService.updateEmployee(user, id, dto);
  }

  @Post('employees/:id/disable')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  @Permissions(SupportPermission.EMPLOYEES_MANAGE)
  disableEmployee(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.disableEmployee(user, id);
  }

  @Delete('employees/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  @Permissions(SupportPermission.EMPLOYEES_MANAGE)
  deleteEmployee(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.deleteEmployee(user, id);
  }

  @Get('conversations')
  @Roles(...SUPPORT_USERS)
  listConversations(
    @CurrentUser() user: SupportUserContext,
    @Query() query: ListConversationsDto,
  ) {
    return this.supportService.listConversations(user, query);
  }

  @Get('conversations/:id')
  @Roles(...SUPPORT_USERS)
  getConversation(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.getConversation(user, id);
  }

  @Get('conversations/:id/messages')
  @Roles(...SUPPORT_USERS)
  listMessages(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Query('after') after?: string,
  ) {
    return this.supportService.listMessages(user, id, after);
  }

  @Post('conversations/:id/read')
  @Roles(...SUPPORT_USERS)
  markConversationRead(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.markConversationRead(user, id);
  }

  @Post('conversations/:id/messages')
  @Roles(...SUPPORT_USERS)
  @Permissions(SupportPermission.CONVERSATIONS_REPLY)
  sendMessage(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.sendMessage(user, id, dto);
  }

  @Post('conversations/:id/messages/media')
  @Roles(...SUPPORT_USERS)
  @Permissions(SupportPermission.CONVERSATIONS_REPLY)
  sendMedia(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() body: { base64Data: string; mimetype: string; filename: string; caption?: string; clientMessageId?: string },
  ) {
    if (!body.base64Data || !body.mimetype || !body.filename) {
      throw new BadRequestException('base64Data, mimetype and filename are required');
    }
    const clientMessageId =
      typeof body.clientMessageId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.clientMessageId)
        ? body.clientMessageId
        : undefined;
    return this.supportService.sendMediaMessage(
      user, id, body.base64Data, body.mimetype, body.filename, body.caption, clientMessageId,
    );
  }

  @Patch('conversations/:id/contact')
  @Roles(...SUPPORT_USERS)
  @Permissions(SupportPermission.CONTACTS_EDIT)
  @ApiOperation({ summary: 'Set the internal display name of the contact' })
  updateContact(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.supportService.updateContact(user, id, dto);
  }

  @Patch('conversations/:id/ai')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.AI_MANAGE)
  @ApiOperation({ summary: 'Pause or resume AI auto-reply for one conversation' })
  updateConversationAi(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateConversationAiDto,
  ) {
    return this.supportService.updateConversationAi(user, id, dto);
  }

  @Post('conversations/:id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.CONVERSATIONS_ASSIGN)
  assignConversation(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.supportService.assignConversation(user, id, dto);
  }

  @Post('conversations/:id/unassign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.CONVERSATIONS_ASSIGN)
  unassignConversation(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.unassignConversation(user, id);
  }

  @Post('conversations/:id/claim')
  @Roles(UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN, UserRole.TENANT_ADMIN)
  @Permissions(SupportPermission.CONVERSATIONS_CLAIM)
  claimConversation(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.claimConversation(user, id);
  }

  @Patch('conversations/:id/status')
  @Roles(...SUPPORT_USERS)
  @Permissions(SupportPermission.CONVERSATIONS_CLOSE)
  updateConversationStatus(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateConversationStatusDto,
  ) {
    return this.supportService.updateConversationStatus(user, id, dto);
  }

  @Get('conversations/:id/notes')
  @Roles(...SUPPORT_USERS)
  listNotes(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.listNotes(user, id);
  }

  @Post('conversations/:id/notes')
  @Roles(...SUPPORT_USERS)
  @Permissions(SupportPermission.NOTES_MANAGE)
  createNote(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: CreateInternalNoteDto,
  ) {
    return this.supportService.createNote(user, id, dto);
  }

  @Delete('notes/:id')
  @Roles(...SUPPORT_USERS)
  @Permissions(SupportPermission.NOTES_MANAGE)
  deleteNote(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.deleteNote(user, id);
  }

  @Get('quick-replies')
  @Roles(...SUPPORT_USERS)
  listQuickReplies(
    @CurrentUser() user: SupportUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.supportService.listQuickReplies(user, companyId);
  }

  @Post('quick-replies')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.QUICK_REPLIES_MANAGE)
  createQuickReply(
    @CurrentUser() user: SupportUserContext,
    @Body() dto: CreateQuickReplyDto,
  ) {
    return this.supportService.createQuickReply(user, dto);
  }

  @Patch('quick-replies/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.QUICK_REPLIES_MANAGE)
  updateQuickReply(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateQuickReplyDto,
  ) {
    return this.supportService.updateQuickReply(user, id, dto);
  }

  @Delete('quick-replies/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.QUICK_REPLIES_MANAGE)
  deleteQuickReply(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.deleteQuickReply(user, id);
  }

  @Get('tags')
  @Roles(...SUPPORT_USERS)
  listTags(@CurrentUser() user: SupportUserContext, @Query('companyId') companyId?: string) {
    return this.supportService.listTags(user, companyId);
  }

  @Post('tags')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.TAGS_MANAGE)
  createTag(@CurrentUser() user: SupportUserContext, @Body() dto: CreateTagDto) {
    return this.supportService.createTag(user, dto);
  }

  @Patch('tags/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.TAGS_MANAGE)
  updateTag(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.supportService.updateTag(user, id, dto);
  }

  @Delete('tags/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.TAGS_MANAGE)
  deleteTag(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    return this.supportService.deleteTag(user, id);
  }

  @Post('conversations/:id/tags')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.TAGS_MANAGE)
  updateConversationTags(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateConversationTagsDto,
  ) {
    return this.supportService.updateConversationTags(user, id, dto);
  }

  @Delete('conversations/:id/tags/:tagId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)
  @Permissions(SupportPermission.TAGS_MANAGE)
  removeConversationTag(
    @CurrentUser() user: SupportUserContext,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.supportService.removeConversationTag(user, id, tagId);
  }

  @Get('support/settings')
  @Roles(...SUPPORT_USERS)
  getSettings(
    @CurrentUser() user: SupportUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.supportService.getSettings(user, companyId);
  }

  @Patch('support/settings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  @Permissions(SupportPermission.SETTINGS_MANAGE)
  updateSettings(
    @CurrentUser() user: SupportUserContext,
    @Body() dto: UpdateSupportSettingsDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.supportService.updateSettings(user, dto, companyId);
  }

  @Post('support/sync-history')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN)
  @Permissions(SupportPermission.WHATSAPP_MANAGE)
  syncHistory(
    @CurrentUser() user: SupportUserContext,
    @Query('companyId') companyId?: string,
  ) {
    return this.supportService.syncWhatsappHistory(user, companyId);
  }

  @Post('conversations/:id/ai-assist')
  @Roles(...SUPPORT_USERS)
  async aiAssist(@CurrentUser() user: SupportUserContext, @Param('id') id: string) {
    // Goes through the scoped lookup so an agent can't pull another agent's conversation.
    const conversation = await this.supportService.getConversation(user, id);
    return this.supportAiService.generateAssist(id, String((conversation as any).companyId));
  }
}
