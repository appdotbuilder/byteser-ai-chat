import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable, messagesTable, researchSourcesTable } from '../db/schema';
import { deleteConversation } from '../handlers/delete_conversation';
import { eq } from 'drizzle-orm';

describe('deleteConversation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a conversation that belongs to the user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        password_hash: 'hashedpassword123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test conversation
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user_id: userId,
        title: 'Test Conversation'
      })
      .returning()
      .execute();

    const conversationId = conversationResult[0].id;

    // Delete the conversation
    const result = await deleteConversation(conversationId, userId);

    // Should return true indicating successful deletion
    expect(result).toBe(true);

    // Verify conversation is deleted from database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .execute();

    expect(conversations).toHaveLength(0);
  });

  it('should return false when conversation does not exist', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        password_hash: 'hashedpassword123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const nonExistentConversationId = 999;

    // Try to delete non-existent conversation
    const result = await deleteConversation(nonExistentConversationId, userId);

    // Should return false as no rows were affected
    expect(result).toBe(false);
  });

  it('should return false when conversation belongs to different user', async () => {
    // Create first test user
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        display_name: 'User One',
        password_hash: 'hashedpassword123'
      })
      .returning()
      .execute();

    // Create second test user
    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        display_name: 'User Two',
        password_hash: 'hashedpassword456'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create conversation owned by user1
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user_id: user1Id,
        title: 'User 1 Conversation'
      })
      .returning()
      .execute();

    const conversationId = conversationResult[0].id;

    // Try to delete with user2's ID
    const result = await deleteConversation(conversationId, user2Id);

    // Should return false as user2 doesn't own this conversation
    expect(result).toBe(false);

    // Verify conversation still exists in database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .execute();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].user_id).toEqual(user1Id);
  });

  it('should cascade delete messages and research sources', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        password_hash: 'hashedpassword123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test conversation
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user_id: userId,
        title: 'Test Conversation'
      })
      .returning()
      .execute();

    const conversationId = conversationResult[0].id;

    // Create test message
    const messageResult = await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        content: 'Test message',
        role: 'user'
      })
      .returning()
      .execute();

    const messageId = messageResult[0].id;

    // Create test research source
    await db.insert(researchSourcesTable)
      .values({
        message_id: messageId,
        title: 'Test Source',
        url: 'https://example.com',
        snippet: 'Test snippet',
        relevance_score: '0.95'
      })
      .execute();

    // Delete the conversation
    const result = await deleteConversation(conversationId, userId);

    expect(result).toBe(true);

    // Verify conversation is deleted
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .execute();

    expect(conversations).toHaveLength(0);

    // Verify messages are cascade deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, conversationId))
      .execute();

    expect(messages).toHaveLength(0);

    // Verify research sources are cascade deleted
    const researchSources = await db.select()
      .from(researchSourcesTable)
      .where(eq(researchSourcesTable.message_id, messageId))
      .execute();

    expect(researchSources).toHaveLength(0);
  });

  it('should delete conversation with multiple messages and sources', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        password_hash: 'hashedpassword123'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test conversation
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user_id: userId,
        title: 'Multi-message Conversation'
      })
      .returning()
      .execute();

    const conversationId = conversationResult[0].id;

    // Create multiple test messages
    const message1Result = await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        content: 'First message',
        role: 'user'
      })
      .returning()
      .execute();

    const message2Result = await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        content: 'AI response',
        role: 'assistant'
      })
      .returning()
      .execute();

    // Create research sources for both messages
    await db.insert(researchSourcesTable)
      .values([
        {
          message_id: message1Result[0].id,
          title: 'Source 1',
          url: 'https://example1.com',
          snippet: 'First snippet',
          relevance_score: '0.85'
        },
        {
          message_id: message2Result[0].id,
          title: 'Source 2',
          url: 'https://example2.com',
          snippet: 'Second snippet',
          relevance_score: '0.92'
        }
      ])
      .execute();

    // Delete the conversation
    const result = await deleteConversation(conversationId, userId);

    expect(result).toBe(true);

    // Verify all data is cascade deleted
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .execute();

    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, conversationId))
      .execute();

    const allResearchSources = await db.select()
      .from(researchSourcesTable)
      .execute();

    expect(conversations).toHaveLength(0);
    expect(messages).toHaveLength(0);
    expect(allResearchSources).toHaveLength(0);
  });
});