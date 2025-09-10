import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { messagesTable, conversationsTable, usersTable } from '../db/schema';
import { type CreateMessageInput } from '../schema';
import { createMessage } from '../handlers/create_message';
import { eq } from 'drizzle-orm';

describe('createMessage', () => {
  let testUserId: number;
  let testConversationId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        is_active: true
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test conversation
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'Test Conversation'
      })
      .returning()
      .execute();
    testConversationId = conversationResult[0].id;
  });

  afterEach(resetDB);

  it('should create a user message', async () => {
    const testInput: CreateMessageInput = {
      conversation_id: testConversationId,
      content: 'Hello, this is a test message',
      role: 'user'
    };

    const result = await createMessage(testInput);

    // Basic field validation
    expect(result.conversation_id).toEqual(testConversationId);
    expect(result.content).toEqual('Hello, this is a test message');
    expect(result.role).toEqual('user');
    expect(result.sources).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create an assistant message with sources', async () => {
    const testSources = [
      {
        title: 'Example Article',
        url: 'https://example.com/article',
        snippet: 'This is a relevant snippet from the article'
      },
      {
        title: 'Research Paper',
        url: 'https://research.com/paper',
        snippet: 'Important research findings here'
      }
    ];

    const testInput: CreateMessageInput = {
      conversation_id: testConversationId,
      content: 'Based on my research, here is the answer...',
      role: 'assistant',
      sources: testSources
    };

    const result = await createMessage(testInput);

    // Basic field validation
    expect(result.conversation_id).toEqual(testConversationId);
    expect(result.content).toEqual('Based on my research, here is the answer...');
    expect(result.role).toEqual('assistant');
    expect(result.sources).toEqual(testSources);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save message to database', async () => {
    const testInput: CreateMessageInput = {
      conversation_id: testConversationId,
      content: 'Test message for database validation',
      role: 'user'
    };

    const result = await createMessage(testInput);

    // Query using proper drizzle syntax
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].conversation_id).toEqual(testConversationId);
    expect(messages[0].content).toEqual('Test message for database validation');
    expect(messages[0].role).toEqual('user');
    expect(messages[0].sources).toBeNull();
    expect(messages[0].created_at).toBeInstanceOf(Date);
  });

  it('should save message with sources to database', async () => {
    const testSources = [
      {
        title: 'Test Source',
        url: 'https://test.com/source',
        snippet: 'Test snippet content'
      }
    ];

    const testInput: CreateMessageInput = {
      conversation_id: testConversationId,
      content: 'Message with sources',
      role: 'assistant',
      sources: testSources
    };

    const result = await createMessage(testInput);

    // Query and verify sources are stored correctly
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].sources).toEqual(testSources);
  });

  it('should throw error when conversation does not exist', async () => {
    const testInput: CreateMessageInput = {
      conversation_id: 99999, // Non-existent conversation ID
      content: 'This should fail',
      role: 'user'
    };

    await expect(createMessage(testInput)).rejects.toThrow(/Conversation with id 99999 not found/i);
  });

  it('should handle empty sources array as null', async () => {
    const testInput: CreateMessageInput = {
      conversation_id: testConversationId,
      content: 'Message with empty sources',
      role: 'assistant',
      sources: []
    };

    const result = await createMessage(testInput);

    expect(result.sources).toEqual([]);
    
    // Verify in database
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(messages[0].sources).toEqual([]);
  });

  it('should create multiple messages in same conversation', async () => {
    const firstInput: CreateMessageInput = {
      conversation_id: testConversationId,
      content: 'First message',
      role: 'user'
    };

    const secondInput: CreateMessageInput = {
      conversation_id: testConversationId,
      content: 'Second message',
      role: 'assistant'
    };

    const firstResult = await createMessage(firstInput);
    const secondResult = await createMessage(secondInput);

    // Verify both messages were created
    expect(firstResult.id).not.toEqual(secondResult.id);
    expect(firstResult.conversation_id).toEqual(testConversationId);
    expect(secondResult.conversation_id).toEqual(testConversationId);

    // Verify both are in database
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, testConversationId))
      .execute();

    expect(messages).toHaveLength(2);
  });
});