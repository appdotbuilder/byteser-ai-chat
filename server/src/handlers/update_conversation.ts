import { db } from '../db';
import { conversationsTable } from '../db/schema';
import { type UpdateConversationInput, type Conversation } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateConversation = async (input: UpdateConversationInput, userId: number): Promise<Conversation> => {
  try {
    // First, verify the conversation exists and belongs to the user
    const existingConversation = await db.select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, input.id),
          eq(conversationsTable.user_id, userId)
        )
      )
      .execute();

    if (existingConversation.length === 0) {
      throw new Error('Conversation not found or access denied');
    }

    // Build update values - only include fields that are provided
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateValues.title = input.title;
    }

    // Update the conversation
    const result = await db.update(conversationsTable)
      .set(updateValues)
      .where(
        and(
          eq(conversationsTable.id, input.id),
          eq(conversationsTable.user_id, userId)
        )
      )
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update conversation');
    }

    return result[0];
  } catch (error) {
    console.error('Conversation update failed:', error);
    throw error;
  }
};