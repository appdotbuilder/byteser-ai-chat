import { z } from 'zod';

// User authentication schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string().nullable(), // Nullable for Google OAuth users
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  google_id: z.string().nullable(), // For Google OAuth integration
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Input schemas for user operations
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(), // Optional for Google OAuth
  display_name: z.string().min(1),
  avatar_url: z.string().url().nullable().optional(),
  google_id: z.string().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const googleAuthInputSchema = z.object({
  google_id: z.string(),
  email: z.string().email(),
  display_name: z.string(),
  avatar_url: z.string().url().nullable()
});

export type GoogleAuthInput = z.infer<typeof googleAuthInputSchema>;

// Chat conversation schemas
export const conversationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Conversation = z.infer<typeof conversationSchema>;

export const createConversationInputSchema = z.object({
  user_id: z.number(),
  title: z.string().min(1).max(255)
});

export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;

// Message schemas
export const messageSchema = z.object({
  id: z.number(),
  conversation_id: z.number(),
  content: z.string(),
  role: z.enum(['user', 'assistant']),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string()
  })).nullable(), // Research sources for AI responses
  created_at: z.coerce.date()
});

export type Message = z.infer<typeof messageSchema>;

export const createMessageInputSchema = z.object({
  conversation_id: z.number(),
  content: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string()
  })).nullable().optional()
});

export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;

// AI chat request schema
export const aiChatRequestSchema = z.object({
  conversation_id: z.number(),
  message: z.string().min(1),
  enable_research: z.boolean().default(true) // AI + Research feature toggle
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

// Research source schemas
export const researchSourceSchema = z.object({
  id: z.number(),
  message_id: z.number(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  relevance_score: z.number().min(0).max(1),
  created_at: z.coerce.date()
});

export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const createResearchSourceInputSchema = z.object({
  message_id: z.number(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  relevance_score: z.number().min(0).max(1)
});

export type CreateResearchSourceInput = z.infer<typeof createResearchSourceInputSchema>;

// User session schemas for authentication
export const userSessionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  session_token: z.string(),
  expires_at: z.coerce.date(),
  created_at: z.coerce.date()
});

export type UserSession = z.infer<typeof userSessionSchema>;

export const createSessionInputSchema = z.object({
  user_id: z.number(),
  expires_in_hours: z.number().default(24)
});

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

// Update schemas
export const updateUserInputSchema = z.object({
  id: z.number(),
  display_name: z.string().optional(),
  avatar_url: z.string().url().nullable().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const updateConversationInputSchema = z.object({
  id: z.number(),
  title: z.string().optional()
});

export type UpdateConversationInput = z.infer<typeof updateConversationInputSchema>;