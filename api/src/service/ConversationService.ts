import type { Conversation } from '../models/conversation.js';

export type ConversationCache = {
  get: (conversationId: string) => Conversation | undefined;
  set: (conversationId: string, conversation: Conversation) => void;
  expire: () => Date;
};

export type ConversationServiceConfig = {
  idGenerator: () => string;
  cache: ConversationCache;
};

export class ConversationService {
  constructor(private readonly config: ConversationServiceConfig) {}

  createConversation(): Conversation {
    const conversation: Conversation = {
      conversationId: this.config.idGenerator(),
    };

    this.config.cache.set(conversation.conversationId, conversation);

    return conversation;
  }

  cacheConversation(conversation: Conversation): void {
    this.config.cache.set(conversation.conversationId, conversation);
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.config.cache.get(conversationId);
  }
}
