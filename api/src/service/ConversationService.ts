import { Firestore } from '@google-cloud/firestore';
import type { DocumentReference, Transaction } from '@google-cloud/firestore';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessageChunk,
  HumanMessage,
  MessageContentText,
  SystemMessage,
} from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

export type Conversation = {
  conversationId: string;
  lastResponseId?: string;
};

export type ConversationCache = {
  get: (conversationId: string) => Conversation | undefined;
  set: (conversationId: string, conversation: Conversation) => void;
  expire: () => Date;
};

export type ConversationServiceConfig = {
  idGenerator: () => string;
  cache: ConversationCache;
  firestore: Firestore;
  env: string;
  systemMessage: SystemMessage;
  model: ChatOpenAI;
  vectorStoreId: string;
  contactService: IContactService;
};

export type ConversationResponseInput = {
  conversationId: string;
  text: string;
  responseId?: string | null;
};

export type ConversationStreamResult = {
  conversationId: string;
  responseId: string;
  content: AIMessageChunk['content'];
  expires: Date;
};

export type ConversationStreamEvent =
  | { event: 'started' }
  | { event: 'data'; text: string }
  | { event: 'error'; message: string }
  | { event: 'ended'; result: ConversationStreamResult };

export class ConversationError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ConversationError';
  }
}

export interface IConversationService {
  createConversation(): Conversation;
  streamResponse(
    input: ConversationResponseInput
  ): AsyncGenerator<ConversationStreamEvent, void, void>;
}

// Creates IConversationService based on environment
export function conversationServiceFactory(
  config: ConversationServiceConfig
): IConversationService {
  if (config.env === 'test') {
    console.warn('Using MockConversationService in test environment');
    return new MockConversationService();
  }
  return new ConversationService(config);
}

// Mock service for testing and development
export class MockConversationService implements IConversationService {
  createConversation(): Conversation {
    return { conversationId: 'mock-conversation' };
  }

  async *streamResponse(): AsyncGenerator<ConversationStreamEvent, void, void> {
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    yield { event: 'started' };
    await pause(500);

    const words =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'.split(
        ' '
      );
    const chunk = 5;
    for (let i = 0; i < words.length; i += chunk) {
      yield {
        event: 'data',
        text: words.slice(i, i + chunk).join(' ') + ' ',
      };
      await pause(50);
    }

    yield {
      event: 'ended',
      result: {
        conversationId: 'mock-conversation',
        responseId: 'mock-response',
        content: [{ type: 'text', text: 'This is a mock response.' }],
        expires: new Date(Date.now() + 3600 * 1000),
      },
    };
  }
}

import { IContactService } from './ContactService.js';

// Functional implementation of IConversationService
export class ConversationService implements IConversationService {
  private readonly conversationsCollection = this.config.firestore.collection('conversations');

  constructor(private readonly config: ConversationServiceConfig) {}

  createConversation(): Conversation {
    const conversation: Conversation = {
      conversationId: this.config.idGenerator(),
    };

    this.cacheConversation(conversation);

    return conversation;
  }

  cacheConversation(conversation: Conversation): void {
    this.config.cache.set(conversation.conversationId, conversation);
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.config.cache.get(conversationId);
  }

  //streams response from model, saves to firestore, yields events (as a generator)
  async *streamResponse({
    conversationId,
    text,
    responseId,
  }: ConversationResponseInput): AsyncGenerator<ConversationStreamEvent, void, void> {
    const conversation = await this.resolveConversation(conversationId);

    this.validateConversationStart(conversation, responseId);

    //builds langchain runnable with tools and previous responseId if provided
    const runnable = this.config.model.withConfig({
      tools: [{ type: 'file_search', vector_store_ids: [this.config.vectorStoreId] }],
      tool_choice: 'auto',
      previous_response_id: responseId ?? null,
    });

    const agent = createReactAgent({
      llm: runnable,
      tools: [this.config.contactService.createTool()],
    });

    const messages = [this.config.systemMessage, new HumanMessage(text)];
    const buffer: string[] = [];
    const events = agent.streamEvents({ messages }, { version: 'v2' });

    console.log('starting streaming events...');
    for await (const event of events) {
      if (event.event == 'on_chain_start') {
      } else if (event.event == 'on_chain_end') {
      } else if (event.event == 'on_chain_stream') {
      } else if (event.event == 'on_tool_start') {
      } else if (event.event == 'on_tool_end') {
      } else if (event.event == 'on_chat_model_start') {
        //begin capture
        yield { event: 'started' };
      } else if (event.event == 'on_chat_model_stream') {
        const chunk = event.data.chunk as AIMessageChunk;
        const content = chunk.content[0] as MessageContentText | undefined;

        if (content?.text) buffer.push(content.text);

        const status = chunk.response_metadata?.status;
        if (buffer.length > 5 || status === 'completed') {
          yield { event: 'data', text: buffer.join('') };
          buffer.length = 0;
        }
      } else if (event.event == 'on_chat_model_end') {
        //end buffer
        const chunk = event.data.output as AIMessageChunk;
        const newResponseId = chunk.response_metadata?.id;
        if (!newResponseId) {
          yield { event: 'error', message: 'Model response is missing an identifier.' };
        }
        const expiration = this.config.cache.expire();

        // write the final content to firestore
        await this.save({
          conversationId,
          prompt: text,
          responseId: newResponseId,
          content: chunk.content,
          expires: expiration,
        });

        this.cacheConversation({ conversationId, lastResponseId: newResponseId });

        yield {
          event: 'ended',
          result: {
            conversationId,
            responseId: newResponseId,
            content: chunk.content,
            expires: expiration,
          },
        };
      }
    }
  }

  //gets conversation from cache or firestore, validates expiration or throws error
  private async resolveConversation(conversationId: string): Promise<Conversation> {
    const cached = this.getConversation(conversationId);
    if (cached) return cached;

    const doc = await this.conversationsCollection.doc(conversationId).get();
    if (!doc.exists) {
      throw new ConversationError('Conversation does not exist and may have expired.', 404);
    }

    const data = doc.data();
    if (!data) {
      throw new ConversationError('Conversation data is missing.', 500);
    }

    const expiration = new Date(data.expiration ?? data.expires ?? 0);
    if (Number.isNaN(expiration.getTime()) || Date.now() > expiration.getTime()) {
      throw new ConversationError('Conversation has expired.', 404);
    }

    const conversation: Conversation = {
      conversationId: doc.id,
      lastResponseId: data.responseId,
    };

    this.cacheConversation(conversation);
    return conversation;
  }

  //checks if the responseId is a valid starting point for the conversation
  private validateConversationStart(conversation: Conversation, responseId?: string | null): void {
    if (!conversation.lastResponseId) return;
    if (conversation.lastResponseId === responseId) return;

    throw new ConversationError(
      'Response is not a valid starting point for this conversation.',
      403
    );
  }

  //saves conversation and response data to firestore in a single transaction
  private async save({
    conversationId,
    prompt,
    responseId,
    content,
    expires,
  }: {
    conversationId: string;
    prompt: string;
    responseId: string;
    content: AIMessageChunk['content'];
    expires: Date;
  }): Promise<void> {
    const conversationRef = this.conversationsCollection.doc(conversationId);

    try {
      await this.config.firestore.runTransaction(async (transaction) => {
        this.updateConversationDoc(transaction, conversationRef, responseId, expires);
        this.saveResponseDoc(transaction, conversationRef, responseId, prompt, content);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('failed to update Firestore conversation', error);
    }
  }

  //updates conversation firestore doc with latest responseId and expiration
  private updateConversationDoc(
    transaction: Transaction,
    conversationRef: DocumentReference,
    responseId: string,
    expires: Date
  ): void {
    transaction.set(
      conversationRef,
      {
        responseId,
        expires: expires.toISOString(),
        env: this.config.env,
      },
      { merge: true }
    );
  }

  //saves individual response document in subcollection of conversation
  private saveResponseDoc(
    transaction: Transaction,
    conversationRef: DocumentReference,
    responseId: string,
    prompt: string,
    content: AIMessageChunk['content']
  ): void {
    const responseRef = conversationRef.collection('responses').doc(responseId);

    transaction.set(
      responseRef,
      {
        prompt,
        content,
        created: Date.now(),
      },
      { merge: true }
    );
  }
}
