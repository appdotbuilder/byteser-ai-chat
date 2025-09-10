import { db } from '../db';
import { conversationsTable, usersTable } from '../db/schema';
import { type CreateConversationInput, type Conversation } from '../schema';
import { eq } from 'drizzle-orm';

export const createConversation = async (input: CreateConversationInput): Promise<Conversation> => {
  try {
    // First, validate that the user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with id ${input.user_id} does not exist`);
    }

    // Check if user is active
    if (!existingUser[0].is_active) {
      throw new Error(`User with id ${input.user_id} is not active`);
    }

    // Insert conversation record
    const result = await db.insert(conversationsTable)
      .values({
        user_id: input.user_id,
        title: input.title
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Conversation creation failed:', error);
    throw error;
  }
};