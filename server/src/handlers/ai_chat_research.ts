import { db } from '../db';
import { messagesTable, conversationsTable, usersTable } from '../db/schema';
import { type AiChatRequest, type Message } from '../schema';
import { eq } from 'drizzle-orm';

export const aiChatResearch = async (input: AiChatRequest): Promise<Message> => {
  try {
    // 1. Verify the conversation exists and belongs to a valid user
    const conversation = await db.select()
      .from(conversationsTable)
      .innerJoin(usersTable, eq(conversationsTable.user_id, usersTable.id))
      .where(eq(conversationsTable.id, input.conversation_id))
      .execute();

    if (conversation.length === 0) {
      throw new Error('Conversation not found');
    }

    // 2. Create user message in conversation
    const userMessageResult = await db.insert(messagesTable)
      .values({
        conversation_id: input.conversation_id,
        content: input.message,
        role: 'user',
        sources: null
      })
      .returning()
      .execute();

    // 3. Simulate research sources if research is enabled
    const researchSources = input.enable_research ? [
      {
        title: 'Research Result 1',
        url: 'https://example.com/research1',
        snippet: 'Relevant information from research source 1 related to the user query.'
      },
      {
        title: 'Research Result 2', 
        url: 'https://example.com/research2',
        snippet: 'Additional context from research source 2 that supports the AI response.'
      }
    ] : null;

    // 4. Generate AI response content based on user message and research
    const responseContent = input.enable_research 
      ? `Based on research findings, here's a comprehensive response to "${input.message}": The available research suggests multiple approaches to this topic. Key insights from current sources indicate relevant patterns and best practices that can guide decision-making.`
      : `Here's my response to "${input.message}": I'll provide you with helpful information based on my training, though without additional research context.`;

    // 5. Create assistant message with sources
    const assistantMessageResult = await db.insert(messagesTable)
      .values({
        conversation_id: input.conversation_id,
        content: responseContent,
        role: 'assistant',
        sources: researchSources
      })
      .returning()
      .execute();

    // Return the assistant message
    const assistantMessage = assistantMessageResult[0];
    return {
      ...assistantMessage,
      role: assistantMessage.role as 'user' | 'assistant', // Type assertion for role
      sources: assistantMessage.sources as Message['sources'] // Type assertion for JSONB field
    };
  } catch (error) {
    console.error('AI chat research failed:', error);
    throw error;
  }
};