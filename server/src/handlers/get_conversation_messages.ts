import { db } from '../db';
import { messagesTable } from '../db/schema';
import { type Message } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getConversationMessages = async (conversationId: number): Promise<Message[]> => {
  try {
    // Query messages for the conversation, ordered chronologically
    const results = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, conversationId))
      .orderBy(asc(messagesTable.created_at))
      .execute();

    // Return messages with proper type conversion
    return results.map(message => ({
      ...message,
      role: message.role as 'user' | 'assistant',
      sources: message.sources as Message['sources']
    }));
  } catch (error) {
    console.error('Failed to fetch conversation messages:', error);
    throw error;
  }
};