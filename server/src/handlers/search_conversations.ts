import { db } from '../db';
import { conversationsTable, messagesTable } from '../db/schema';
import { type Conversation } from '../schema';
import { eq, or, ilike, and, sql } from 'drizzle-orm';

export const searchConversations = async (userId: number, query: string): Promise<Conversation[]> => {
  try {
    if (!query.trim()) {
      // Return empty array for empty query
      return [];
    }

    // Prepare search pattern for ILIKE (case-insensitive pattern matching)
    const searchPattern = `%${query.trim()}%`;

    // First, find conversations that match by title
    const titleMatches = await db.select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.user_id, userId),
          ilike(conversationsTable.title, searchPattern)
        )
      )
      .execute();

    // Then, find conversations that have messages matching the query
    const messageMatches = await db.select({
      id: conversationsTable.id,
      user_id: conversationsTable.user_id,
      title: conversationsTable.title,
      created_at: conversationsTable.created_at,
      updated_at: conversationsTable.updated_at
    })
      .from(conversationsTable)
      .innerJoin(messagesTable, eq(conversationsTable.id, messagesTable.conversation_id))
      .where(
        and(
          eq(conversationsTable.user_id, userId),
          ilike(messagesTable.content, searchPattern)
        )
      )
      .execute();

    // Combine results and remove duplicates
    const allMatches = [...titleMatches, ...messageMatches];
    const uniqueConversations = new Map<number, Conversation>();

    allMatches.forEach(conversation => {
      uniqueConversations.set(conversation.id, conversation);
    });

    // Convert Map to array and sort by updated_at (most recent first)
    const results = Array.from(uniqueConversations.values());
    results.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    return results;
  } catch (error) {
    console.error('Conversation search failed:', error);
    throw error;
  }
};