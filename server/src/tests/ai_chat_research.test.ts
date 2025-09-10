import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable, messagesTable } from '../db/schema';
import { type AiChatRequest } from '../schema';
import { aiChatResearch } from '../handlers/ai_chat_research';
import { eq } from 'drizzle-orm';

describe('aiChatResearch', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testConversationId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        display_name: 'Test User'
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

  const testInputWithResearch: AiChatRequest = {
    conversation_id: 0, // Will be set in tests
    message: 'What are the benefits of renewable energy?',
    enable_research: true
  };

  const testInputWithoutResearch: AiChatRequest = {
    conversation_id: 0, // Will be set in tests
    message: 'Tell me about machine learning',
    enable_research: false
  };

  it('should create user message and AI response with research sources', async () => {
    const input = { ...testInputWithResearch, conversation_id: testConversationId };
    
    const result = await aiChatResearch(input);

    // Validate assistant message
    expect(result.conversation_id).toEqual(testConversationId);
    expect(result.role).toEqual('assistant');
    expect(result.content).toContain('Based on research findings');
    expect(result.content).toContain(input.message);
    expect(result.sources).toBeDefined();
    expect(result.sources).toHaveLength(2);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Validate research sources structure
    expect(result.sources![0]).toEqual({
      title: 'Research Result 1',
      url: 'https://example.com/research1',
      snippet: 'Relevant information from research source 1 related to the user query.'
    });

    expect(result.sources![1]).toEqual({
      title: 'Research Result 2',
      url: 'https://example.com/research2', 
      snippet: 'Additional context from research source 2 that supports the AI response.'
    });
  });

  it('should create user message and AI response without research sources', async () => {
    const input = { ...testInputWithoutResearch, conversation_id: testConversationId };
    
    const result = await aiChatResearch(input);

    // Validate assistant message
    expect(result.conversation_id).toEqual(testConversationId);
    expect(result.role).toEqual('assistant');
    expect(result.content).toContain(input.message);
    expect(result.content).not.toContain('research findings');
    expect(result.sources).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save both user and assistant messages to database', async () => {
    const input = { ...testInputWithResearch, conversation_id: testConversationId };
    
    const result = await aiChatResearch(input);

    // Query all messages for the conversation
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, testConversationId))
      .execute();

    // Should have 2 messages: user message and assistant message
    expect(messages).toHaveLength(2);

    // Find user message
    const userMessage = messages.find(msg => msg.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage!.content).toEqual(input.message);
    expect(userMessage!.sources).toBeNull();
    expect(userMessage!.conversation_id).toEqual(testConversationId);

    // Find assistant message
    const assistantMessage = messages.find(msg => msg.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage!.id).toEqual(result.id);
    expect(assistantMessage!.content).toEqual(result.content);
    expect(assistantMessage!.sources).toEqual(result.sources);
    expect(assistantMessage!.conversation_id).toEqual(testConversationId);
  });

  it('should throw error for non-existent conversation', async () => {
    const input = { ...testInputWithResearch, conversation_id: 99999 };
    
    await expect(aiChatResearch(input)).rejects.toThrow(/conversation not found/i);
  });

  it('should handle different message content types', async () => {
    const shortInput = { 
      ...testInputWithResearch, 
      conversation_id: testConversationId,
      message: 'Hi'
    };
    
    const longInput = { 
      ...testInputWithResearch, 
      conversation_id: testConversationId,
      message: 'This is a very long message that contains multiple sentences and covers various topics to test how the AI chat research handler processes longer content inputs and generates appropriate responses.'
    };
    
    const shortResult = await aiChatResearch(shortInput);
    const longResult = await aiChatResearch(longInput);

    expect(shortResult.content).toContain('Hi');
    expect(longResult.content).toContain('very long message');
    expect(shortResult.sources).toHaveLength(2);
    expect(longResult.sources).toHaveLength(2);
  });

  it('should handle research toggle correctly', async () => {
    const researchEnabledInput = { ...testInputWithResearch, conversation_id: testConversationId };
    const researchDisabledInput = { ...testInputWithoutResearch, conversation_id: testConversationId };
    
    const enabledResult = await aiChatResearch(researchEnabledInput);
    const disabledResult = await aiChatResearch(researchDisabledInput);

    expect(enabledResult.sources).toBeDefined();
    expect(enabledResult.sources).toHaveLength(2);
    expect(enabledResult.content).toContain('Based on research findings');
    
    expect(disabledResult.sources).toBeNull();
    expect(disabledResult.content).not.toContain('Based on research findings');
  });
});