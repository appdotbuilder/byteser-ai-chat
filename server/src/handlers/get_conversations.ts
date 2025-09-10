import { db } from '../db';
import { conversationsTable } from '../db/schema';
import { type Conversation } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getConversations = async (userId: number): Promise<Conversation[]> => {
  try {
    // Query conversations for the specific user, ordered by most recent first
    const results = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.user_id, userId))
      .orderBy(desc(conversationsTable.updated_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Get conversations failed:', error);
    throw error;
  }
};