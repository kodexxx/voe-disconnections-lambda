import { Context as GRContext } from 'grammy';
import { Conversation, ConversationFlavor } from '@grammyjs/conversations';

export type MyContext = GRContext & ConversationFlavor;
export type MyConversation = Conversation<MyContext>;
