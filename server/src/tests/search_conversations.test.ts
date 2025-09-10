import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable, messagesTable } from '../db/schema';
import { searchConversations } from '../handlers/search_conversations';

describe('searchConversations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let otherUserId: number;

  beforeEach(async () => {
    // Create test users
    const [testUser] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    testUserId = testUser.id;

    const [otherUser] = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        display_name: 'Other User',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    otherUserId = otherUser.id;
  });

  it('should return empty array for empty query', async () => {
    const results = await searchConversations(testUserId, '');
    expect(results).toEqual([]);

    const resultsWhitespace = await searchConversations(testUserId, '   ');
    expect(resultsWhitespace).toEqual([]);
  });

  it('should find conversations by title', async () => {
    // Create test conversations
    const [conversation1] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'JavaScript Tutorial Discussion'
      })
      .returning()
      .execute();

    const [conversation2] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'Python Programming Help'
      })
      .returning()
      .execute();

    // Search for "JavaScript" - should match conversation1
    const results = await searchConversations(testUserId, 'JavaScript');
    
    expect(results).toHaveLength(1);
    expect(results[0].id).toEqual(conversation1.id);
    expect(results[0].title).toEqual('JavaScript Tutorial Discussion');
    expect(results[0].user_id).toEqual(testUserId);
    expect(results[0].created_at).toBeInstanceOf(Date);
    expect(results[0].updated_at).toBeInstanceOf(Date);
  });

  it('should find conversations by message content', async () => {
    // Create test conversation
    const [conversation] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'General Discussion'
      })
      .returning()
      .execute();

    // Add messages to the conversation
    await db.insert(messagesTable)
      .values({
        conversation_id: conversation.id,
        content: 'I need help with React hooks',
        role: 'user'
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        conversation_id: conversation.id,
        content: 'Sure, React hooks are a powerful feature...',
        role: 'assistant'
      })
      .execute();

    // Search for "React hooks" - should find the conversation
    const results = await searchConversations(testUserId, 'React hooks');
    
    expect(results).toHaveLength(1);
    expect(results[0].id).toEqual(conversation.id);
    expect(results[0].title).toEqual('General Discussion');
  });

  it('should perform case-insensitive search', async () => {
    // Create test conversation
    const [conversation] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'API Development Guide'
      })
      .returning()
      .execute();

    // Test different case variations
    const results1 = await searchConversations(testUserId, 'api');
    const results2 = await searchConversations(testUserId, 'API');
    const results3 = await searchConversations(testUserId, 'Api');
    const results4 = await searchConversations(testUserId, 'development');

    expect(results1).toHaveLength(1);
    expect(results2).toHaveLength(1);
    expect(results3).toHaveLength(1);
    expect(results4).toHaveLength(1);

    // All should return the same conversation
    expect(results1[0].id).toEqual(conversation.id);
    expect(results2[0].id).toEqual(conversation.id);
    expect(results3[0].id).toEqual(conversation.id);
    expect(results4[0].id).toEqual(conversation.id);
  });

  it('should only return conversations for the specified user', async () => {
    // Create conversations for different users
    await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'My React Project'
      })
      .execute();

    await db.insert(conversationsTable)
      .values({
        user_id: otherUserId,
        title: 'My React Project'
      })
      .execute();

    // Search should only return the conversation for testUserId
    const results = await searchConversations(testUserId, 'React Project');
    
    expect(results).toHaveLength(1);
    expect(results[0].user_id).toEqual(testUserId);
  });

  it('should remove duplicate conversations when matching both title and content', async () => {
    // Create conversation that matches both title and message content
    const [conversation] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'Docker Tutorial'
      })
      .returning()
      .execute();

    await db.insert(messagesTable)
      .values({
        conversation_id: conversation.id,
        content: 'Let me explain Docker containers...',
        role: 'assistant'
      })
      .execute();

    // Search for "Docker" - should match both title and message but return only one result
    const results = await searchConversations(testUserId, 'Docker');
    
    expect(results).toHaveLength(1);
    expect(results[0].id).toEqual(conversation.id);
  });

  it('should return results sorted by updated_at (most recent first)', async () => {
    // Create conversations with different timestamps
    const [conversation1] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'First Programming Discussion'
      })
      .returning()
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const [conversation2] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'Second Programming Discussion'
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const [conversation3] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'Third Programming Discussion'
      })
      .returning()
      .execute();

    const results = await searchConversations(testUserId, 'Programming');
    
    expect(results).toHaveLength(3);
    
    // Results should be sorted by updated_at descending (most recent first)
    expect(results[0].id).toEqual(conversation3.id);
    expect(results[1].id).toEqual(conversation2.id);
    expect(results[2].id).toEqual(conversation1.id);

    // Verify timestamps are in descending order
    expect(results[0].updated_at.getTime()).toBeGreaterThanOrEqual(results[1].updated_at.getTime());
    expect(results[1].updated_at.getTime()).toBeGreaterThanOrEqual(results[2].updated_at.getTime());
  });

  it('should return empty array when no matches found', async () => {
    // Create some conversations that won't match
    await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'JavaScript Help'
      })
      .execute();

    const results = await searchConversations(testUserId, 'nonexistent query');
    expect(results).toEqual([]);
  });

  it('should handle partial word matching', async () => {
    // Create test conversation
    const [conversation] = await db.insert(conversationsTable)
      .values({
        user_id: testUserId,
        title: 'Understanding TypeScript'
      })
      .returning()
      .execute();

    // Partial matches should work
    const results1 = await searchConversations(testUserId, 'Type');
    const results2 = await searchConversations(testUserId, 'Script');
    const results3 = await searchConversations(testUserId, 'Understanding');

    expect(results1).toHaveLength(1);
    expect(results2).toHaveLength(1);
    expect(results3).toHaveLength(1);

    expect(results1[0].id).toEqual(conversation.id);
    expect(results2[0].id).toEqual(conversation.id);
    expect(results3[0].id).toEqual(conversation.id);
  });
});