import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable } from '../db/schema';
import { getConversations } from '../handlers/get_conversations';

describe('getConversations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no conversations', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User'
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const result = await getConversations(userId);

    expect(result).toEqual([]);
  });

  it('should return conversations for specific user only', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        display_name: 'User 1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        display_name: 'User 2'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create conversations for both users
    await db.insert(conversationsTable)
      .values([
        {
          user_id: user1Id,
          title: 'User 1 Conversation 1'
        },
        {
          user_id: user1Id,
          title: 'User 1 Conversation 2'
        },
        {
          user_id: user2Id,
          title: 'User 2 Conversation'
        }
      ])
      .execute();

    const user1Conversations = await getConversations(user1Id);
    const user2Conversations = await getConversations(user2Id);

    expect(user1Conversations).toHaveLength(2);
    expect(user2Conversations).toHaveLength(1);

    // Verify user1 only gets their conversations
    user1Conversations.forEach(conv => {
      expect(conv.user_id).toEqual(user1Id);
    });

    // Verify user2 only gets their conversations
    user2Conversations.forEach(conv => {
      expect(conv.user_id).toEqual(user2Id);
    });

    expect(user1Conversations[0].title).toEqual('User 1 Conversation 1');
    expect(user1Conversations[1].title).toEqual('User 1 Conversation 2');
    expect(user2Conversations[0].title).toEqual('User 2 Conversation');
  });

  it('should return conversations ordered by most recent first', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User'
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create conversations at different times
    const baseTime = new Date('2024-01-01T10:00:00Z');
    const olderTime = new Date('2024-01-01T09:00:00Z');
    const newerTime = new Date('2024-01-01T11:00:00Z');

    await db.insert(conversationsTable)
      .values([
        {
          user_id: userId,
          title: 'Middle Conversation',
          created_at: baseTime,
          updated_at: baseTime
        },
        {
          user_id: userId,
          title: 'Oldest Conversation',
          created_at: olderTime,
          updated_at: olderTime
        },
        {
          user_id: userId,
          title: 'Newest Conversation',
          created_at: newerTime,
          updated_at: newerTime
        }
      ])
      .execute();

    const result = await getConversations(userId);

    expect(result).toHaveLength(3);
    
    // Should be ordered by updated_at descending (most recent first)
    expect(result[0].title).toEqual('Newest Conversation');
    expect(result[1].title).toEqual('Middle Conversation');
    expect(result[2].title).toEqual('Oldest Conversation');

    // Verify timestamps are in descending order
    expect(result[0].updated_at.getTime()).toBeGreaterThan(result[1].updated_at.getTime());
    expect(result[1].updated_at.getTime()).toBeGreaterThan(result[2].updated_at.getTime());
  });

  it('should return all conversation fields correctly', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User'
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create a conversation
    await db.insert(conversationsTable)
      .values({
        user_id: userId,
        title: 'Test Conversation'
      })
      .execute();

    const result = await getConversations(userId);

    expect(result).toHaveLength(1);
    
    const conversation = result[0];
    expect(conversation.id).toBeDefined();
    expect(typeof conversation.id).toBe('number');
    expect(conversation.user_id).toEqual(userId);
    expect(conversation.title).toEqual('Test Conversation');
    expect(conversation.created_at).toBeInstanceOf(Date);
    expect(conversation.updated_at).toBeInstanceOf(Date);
  });

  it('should handle non-existent user gracefully', async () => {
    const nonExistentUserId = 99999;

    const result = await getConversations(nonExistentUserId);

    expect(result).toEqual([]);
  });
});