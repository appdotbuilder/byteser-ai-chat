import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable } from '../db/schema';
import { type UpdateConversationInput } from '../schema';
import { updateConversation } from '../handlers/update_conversation';
import { eq } from 'drizzle-orm';

describe('updateConversation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testConversationId: number;
  let otherUserId: number;
  let otherConversationId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          display_name: 'Test User',
          password_hash: 'hash123',
          is_active: true
        },
        {
          email: 'other@example.com',
          display_name: 'Other User',
          password_hash: 'hash456',
          is_active: true
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    otherUserId = users[1].id;

    // Create test conversations
    const conversations = await db.insert(conversationsTable)
      .values([
        {
          user_id: testUserId,
          title: 'Original Title'
        },
        {
          user_id: otherUserId,
          title: 'Other User Conversation'
        }
      ])
      .returning()
      .execute();

    testConversationId = conversations[0].id;
    otherConversationId = conversations[1].id;
  });

  it('should update conversation title successfully', async () => {
    const input: UpdateConversationInput = {
      id: testConversationId,
      title: 'Updated Title'
    };

    const result = await updateConversation(input, testUserId);

    expect(result.id).toEqual(testConversationId);
    expect(result.title).toEqual('Updated Title');
    expect(result.user_id).toEqual(testUserId);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify the update was persisted in database
    const updatedConversation = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, testConversationId))
      .execute();

    expect(updatedConversation).toHaveLength(1);
    expect(updatedConversation[0].title).toEqual('Updated Title');
    expect(updatedConversation[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update updated_at timestamp even when no fields change', async () => {
    // Get original timestamp
    const originalConversation = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, testConversationId))
      .execute();

    const originalTimestamp = originalConversation[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: UpdateConversationInput = {
      id: testConversationId
      // No title provided, should still update timestamp
    };

    const result = await updateConversation(input, testUserId);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
  });

  it('should handle partial updates correctly', async () => {
    const input: UpdateConversationInput = {
      id: testConversationId,
      title: 'Partially Updated'
    };

    const result = await updateConversation(input, testUserId);

    expect(result.title).toEqual('Partially Updated');
    expect(result.user_id).toEqual(testUserId);
    expect(result.id).toEqual(testConversationId);
    
    // Verify other fields remain unchanged
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should throw error when conversation does not exist', async () => {
    const input: UpdateConversationInput = {
      id: 99999, // Non-existent ID
      title: 'Should Fail'
    };

    await expect(updateConversation(input, testUserId))
      .rejects.toThrow(/conversation not found or access denied/i);
  });

  it('should throw error when user does not own the conversation', async () => {
    const input: UpdateConversationInput = {
      id: otherConversationId, // Belongs to other user
      title: 'Unauthorized Update'
    };

    await expect(updateConversation(input, testUserId))
      .rejects.toThrow(/conversation not found or access denied/i);
  });

  it('should throw error when user ID is invalid', async () => {
    const input: UpdateConversationInput = {
      id: testConversationId,
      title: 'Should Fail'
    };

    await expect(updateConversation(input, 99999))
      .rejects.toThrow(/conversation not found or access denied/i);
  });

  it('should preserve conversation ownership after update', async () => {
    const input: UpdateConversationInput = {
      id: testConversationId,
      title: 'Ownership Test'
    };

    const result = await updateConversation(input, testUserId);

    expect(result.user_id).toEqual(testUserId);

    // Verify in database that ownership hasn't changed
    const verifyConversation = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, testConversationId))
      .execute();

    expect(verifyConversation[0].user_id).toEqual(testUserId);
  });

  it('should handle empty title updates', async () => {
    const input: UpdateConversationInput = {
      id: testConversationId,
      title: ''
    };

    const result = await updateConversation(input, testUserId);

    expect(result.title).toEqual('');
    expect(result.id).toEqual(testConversationId);
  });
});