import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable } from '../db/schema';
import { type CreateConversationInput } from '../schema';
import { createConversation } from '../handlers/create_conversation';
import { eq } from 'drizzle-orm';

describe('createConversation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a conversation for an existing active user', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        is_active: true
      })
      .returning()
      .execute();

    const testUser = userResult[0];

    const testInput: CreateConversationInput = {
      user_id: testUser.id,
      title: 'My First Conversation'
    };

    const result = await createConversation(testInput);

    // Basic field validation
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(testUser.id);
    expect(result.title).toEqual('My First Conversation');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save conversation to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        is_active: true
      })
      .returning()
      .execute();

    const testUser = userResult[0];

    const testInput: CreateConversationInput = {
      user_id: testUser.id,
      title: 'Database Test Conversation'
    };

    const result = await createConversation(testInput);

    // Query database to verify conversation was saved
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, result.id))
      .execute();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].user_id).toEqual(testUser.id);
    expect(conversations[0].title).toEqual('Database Test Conversation');
    expect(conversations[0].created_at).toBeInstanceOf(Date);
    expect(conversations[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const testInput: CreateConversationInput = {
      user_id: 99999, // Non-existent user ID
      title: 'This should fail'
    };

    await expect(createConversation(testInput))
      .rejects
      .toThrow(/User with id 99999 does not exist/i);
  });

  it('should throw error when user is inactive', async () => {
    // Create inactive test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'inactive@example.com',
        display_name: 'Inactive User',
        is_active: false
      })
      .returning()
      .execute();

    const inactiveUser = userResult[0];

    const testInput: CreateConversationInput = {
      user_id: inactiveUser.id,
      title: 'This should also fail'
    };

    await expect(createConversation(testInput))
      .rejects
      .toThrow(/User with id .* is not active/i);
  });

  it('should handle long conversation titles correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        is_active: true
      })
      .returning()
      .execute();

    const testUser = userResult[0];

    // Test with maximum length title (255 characters as per schema)
    const longTitle = 'A'.repeat(255);
    
    const testInput: CreateConversationInput = {
      user_id: testUser.id,
      title: longTitle
    };

    const result = await createConversation(testInput);

    expect(result.title).toEqual(longTitle);
    expect(result.title.length).toEqual(255);
  });

  it('should create multiple conversations for the same user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        is_active: true
      })
      .returning()
      .execute();

    const testUser = userResult[0];

    // Create first conversation
    const firstInput: CreateConversationInput = {
      user_id: testUser.id,
      title: 'First Conversation'
    };

    const firstResult = await createConversation(firstInput);

    // Create second conversation
    const secondInput: CreateConversationInput = {
      user_id: testUser.id,
      title: 'Second Conversation'
    };

    const secondResult = await createConversation(secondInput);

    // Verify both conversations exist and have different IDs
    expect(firstResult.id).not.toEqual(secondResult.id);
    expect(firstResult.user_id).toEqual(testUser.id);
    expect(secondResult.user_id).toEqual(testUser.id);
    expect(firstResult.title).toEqual('First Conversation');
    expect(secondResult.title).toEqual('Second Conversation');

    // Verify both are in database
    const allConversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.user_id, testUser.id))
      .execute();

    expect(allConversations).toHaveLength(2);
  });
});