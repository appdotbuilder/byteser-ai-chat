import { db } from '../db';
import { messagesTable, conversationsTable } from '../db/schema';
import { type CreateMessageInput, type Message } from '../schema';
import { eq } from 'drizzle-orm';

export const createMessage = async (input: CreateMessageInput): Promise<Message> => {
  try {
    // Validate that the conversation exists
    const conversation = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, input.conversation_id))
      .execute();

    if (conversation.length === 0) {
      throw new Error(`Conversation with id ${input.conversation_id} not found`);
    }

    // Insert message record
    const result = await db.insert(messagesTable)
      .values({
        conversation_id: input.conversation_id,
        content: input.content,
        role: input.role,
        sources: input.sources || null
      })
      .returning()
      .execute();

    const message = result[0];
    return {
      ...message,
      role: message.role as 'user' | 'assistant', // Type assertion for enum
      sources: message.sources as { title: string; url: string; snippet: string; }[] | null,
      created_at: message.created_at // Already a Date object from timestamp
    };
  } catch (error) {
    console.error('Message creation failed:', error);
    throw error;
  }
};