import { serial, text, pgTable, timestamp, boolean, integer, numeric, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table for authentication
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash'), // Nullable for Google OAuth users
  display_name: text('display_name').notNull(),
  avatar_url: text('avatar_url'), // Nullable by default
  google_id: text('google_id').unique(), // For Google OAuth integration
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// User sessions for authentication tokens
export const userSessionsTable = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  session_token: text('session_token').notNull().unique(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Conversations table
export const conversationsTable = pgTable('conversations', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Messages table for chat messages
export const messagesTable = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversation_id: integer('conversation_id').notNull().references(() => conversationsTable.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  role: text('role').notNull(), // 'user' or 'assistant'
  sources: jsonb('sources'), // JSON array of research sources, nullable
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Research sources table for AI research citations
export const researchSourcesTable = pgTable('research_sources', {
  id: serial('id').primaryKey(),
  message_id: integer('message_id').notNull().references(() => messagesTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  snippet: text('snippet').notNull(),
  relevance_score: numeric('relevance_score', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  sessions: many(userSessionsTable),
  conversations: many(conversationsTable)
}));

export const userSessionsRelations = relations(userSessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userSessionsTable.user_id],
    references: [usersTable.id]
  })
}));

export const conversationsRelations = relations(conversationsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [conversationsTable.user_id],
    references: [usersTable.id]
  }),
  messages: many(messagesTable)
}));

export const messagesRelations = relations(messagesTable, ({ one, many }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversation_id],
    references: [conversationsTable.id]
  }),
  researchSources: many(researchSourcesTable)
}));

export const researchSourcesRelations = relations(researchSourcesTable, ({ one }) => ({
  message: one(messagesTable, {
    fields: [researchSourcesTable.message_id],
    references: [messagesTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type UserSession = typeof userSessionsTable.$inferSelect;
export type NewUserSession = typeof userSessionsTable.$inferInsert;

export type Conversation = typeof conversationsTable.$inferSelect;
export type NewConversation = typeof conversationsTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type ResearchSource = typeof researchSourcesTable.$inferSelect;
export type NewResearchSource = typeof researchSourcesTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  userSessions: userSessionsTable,
  conversations: conversationsTable,
  messages: messagesTable,
  researchSources: researchSourcesTable
};