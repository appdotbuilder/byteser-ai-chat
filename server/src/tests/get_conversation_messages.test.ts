import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable, messagesTable } from '../db/schema';
import { type CreateUserInput, type CreateConversationInput, type CreateMessageInput } from '../schema';
import { getConversationMessages } from '../handlers/get_conversation_messages';

// Test data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  display_name: 'Test User'
};

const testConversation: CreateConversationInput = {
  user_id: 1,
  title: 'Test Conversation'
};

const testMessages: CreateMessageInput[] = [
  {
    conversation_id: 1,
    content: 'Hello, I need help with research',
    role: 'user'
  },
  {
    conversation_id: 1,
    content: 'I can help you with that! What would you like to research?',
    role: 'assistant',
    sources: [
      {
        title: 'Research Guide',
        url: 'https://example.com/guide',
        snippet: 'A comprehensive guide to research methods'
      }
    ]
  },
  {
    conversation_id: 1,
    content: 'Can you help me find information about AI?',
    role: 'user'
  }
];

describe('getConversationMessages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return messages for a conversation in chronological order', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: 'hashed_password',
        display_name: testUser.display_name,
        is_active: true
      })
      .returning()
      .execute();

    const [conversation] = await db.insert(conversationsTable)
      .values({
        user_id: user.id,
        title: testConversation.title
      })
      .returning()
      .execute();

    // Create messages with slight delay to ensure different timestamps
    for (const messageInput of testMessages) {
      await db.insert(messagesTable)
        .values({
          conversation_id: conversation.id,
          content: messageInput.content,
          role: messageInput.role,
          sources: messageInput.sources || null
        })
        .execute();
    }

    const messages = await getConversationMessages(conversation.id);

    // Verify correct number of messages
    expect(messages).toHaveLength(3);

    // Verify chronological order (created_at should be ascending)
    for (let i = 1; i < messages.length; i++) {
      expect(messages[i].created_at.getTime()).toBeGreaterThanOrEqual(
        messages[i - 1].created_at.getTime()
      );
    }

    // Verify message content and roles
    expect(messages[0].content).toBe('Hello, I need help with research');
    expect(messages[0].role).toBe('user');
    expect(messages[0].sources).toBeNull();

    expect(messages[1].content).toBe('I can help you with that! What would you like to research?');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].sources).toEqual([
      {
        title: 'Research Guide',
        url: 'https://example.com/guide',
        snippet: 'A comprehensive guide to research methods'
      }
    ]);

    expect(messages[2].content).toBe('Can you help me find information about AI?');
    expect(messages[2].role).toBe('user');
    expect(messages[2].sources).toBeNull();

    // Verify all messages have proper conversation_id
    messages.forEach(message => {
      expect(message.conversation_id).toBe(conversation.id);
      expect(message.id).toBeDefined();
      expect(message.created_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array for conversation with no messages', async () => {
    // Create user and conversation without messages
    const [user] = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: 'hashed_password',
        display_name: testUser.display_name,
        is_active: true
      })
      .returning()
      .execute();

    const [conversation] = await db.insert(conversationsTable)
      .values({
        user_id: user.id,
        title: testConversation.title
      })
      .returning()
      .execute();

    const messages = await getConversationMessages(conversation.id);

    expect(messages).toEqual([]);
  });

  it('should return empty array for non-existent conversation', async () => {
    const messages = await getConversationMessages(999);

    expect(messages).toEqual([]);
  });

  it('should handle messages with complex research sources', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: 'hashed_password',
        display_name: testUser.display_name,
        is_active: true
      })
      .returning()
      .execute();

    const [conversation] = await db.insert(conversationsTable)
      .values({
        user_id: user.id,
        title: testConversation.title
      })
      .returning()
      .execute();

    // Create message with multiple research sources
    const complexSources = [
      {
        title: 'First Source',
        url: 'https://example1.com',
        snippet: 'First research snippet'
      },
      {
        title: 'Second Source',
        url: 'https://example2.com',
        snippet: 'Second research snippet'
      }
    ];

    await db.insert(messagesTable)
      .values({
        conversation_id: conversation.id,
        content: 'Here are multiple research sources',
        role: 'assistant',
        sources: complexSources
      })
      .execute();

    const messages = await getConversationMessages(conversation.id);

    expect(messages).toHaveLength(1);
    expect(messages[0].sources).toEqual(complexSources);
    expect(messages[0].sources).toHaveLength(2);
    expect(messages[0].sources![0].title).toBe('First Source');
    expect(messages[0].sources![1].title).toBe('Second Source');
  });

  it('should only return messages for the specified conversation', async () => {
    // Create user and two conversations
    const [user] = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: 'hashed_password',
        display_name: testUser.display_name,
        is_active: true
      })
      .returning()
      .execute();

    const [conversation1] = await db.insert(conversationsTable)
      .values({
        user_id: user.id,
        title: 'Conversation 1'
      })
      .returning()
      .execute();

    const [conversation2] = await db.insert(conversationsTable)
      .values({
        user_id: user.id,
        title: 'Conversation 2'
      })
      .returning()
      .execute();

    // Add messages to both conversations
    await db.insert(messagesTable)
      .values([
        {
          conversation_id: conversation1.id,
          content: 'Message in conversation 1',
          role: 'user',
          sources: null
        },
        {
          conversation_id: conversation2.id,
          content: 'Message in conversation 2',
          role: 'user',
          sources: null
        }
      ])
      .execute();

    // Get messages for conversation 1
    const messages1 = await getConversationMessages(conversation1.id);
    expect(messages1).toHaveLength(1);
    expect(messages1[0].content).toBe('Message in conversation 1');
    expect(messages1[0].conversation_id).toBe(conversation1.id);

    // Get messages for conversation 2
    const messages2 = await getConversationMessages(conversation2.id);
    expect(messages2).toHaveLength(1);
    expect(messages2[0].content).toBe('Message in conversation 2');
    expect(messages2[0].conversation_id).toBe(conversation2.id);
  });
});