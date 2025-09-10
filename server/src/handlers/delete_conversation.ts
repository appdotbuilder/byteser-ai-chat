import { db } from '../db';
import { conversationsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deleteConversation(conversationId: number, userId: number): Promise<boolean> {
  try {
    // Delete the conversation only if it belongs to the specified user
    // This ensures users can only delete their own conversations
    const result = await db.delete(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.user_id, userId)
        )
      )
      .execute();

    // Check if any rows were affected (conversation existed and was deleted)
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Conversation deletion failed:', error);
    throw error;
  }
}