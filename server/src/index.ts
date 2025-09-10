import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  googleAuthInputSchema,
  createConversationInputSchema,
  createMessageInputSchema,
  aiChatRequestSchema,
  updateConversationInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { loginUser } from './handlers/login_user';
import { googleAuth } from './handlers/google_auth';
import { getUserProfile } from './handlers/get_user_profile';
import { createConversation } from './handlers/create_conversation';
import { getConversations } from './handlers/get_conversations';
import { getConversationMessages } from './handlers/get_conversation_messages';
import { createMessage } from './handlers/create_message';
import { aiChatResearch } from './handlers/ai_chat_research';
import { searchConversations } from './handlers/search_conversations';
import { deleteConversation } from './handlers/delete_conversation';
import { updateConversation } from './handlers/update_conversation';
import { logoutUser } from './handlers/logout_user';
import { validateSession } from './handlers/validate_session';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  loginUser: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),

  googleAuth: publicProcedure
    .input(googleAuthInputSchema)
    .mutation(({ input }) => googleAuth(input)),

  logoutUser: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .mutation(({ input }) => logoutUser(input.sessionToken)),

  validateSession: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .query(({ input }) => validateSession(input.sessionToken)),

  getUserProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserProfile(input.userId)),

  // Conversation management routes
  createConversation: publicProcedure
    .input(createConversationInputSchema)
    .mutation(({ input }) => createConversation(input)),

  getConversations: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getConversations(input.userId)),

  getConversationMessages: publicProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(({ input }) => getConversationMessages(input.conversationId)),

  updateConversation: publicProcedure
    .input(updateConversationInputSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => updateConversation(input, input.userId)),

  deleteConversation: publicProcedure
    .input(z.object({ conversationId: z.number(), userId: z.number() }))
    .mutation(({ input }) => deleteConversation(input.conversationId, input.userId)),

  searchConversations: publicProcedure
    .input(z.object({ userId: z.number(), query: z.string() }))
    .query(({ input }) => searchConversations(input.userId, input.query)),

  // Message and AI chat routes
  createMessage: publicProcedure
    .input(createMessageInputSchema)
    .mutation(({ input }) => createMessage(input)),

  aiChatResearch: publicProcedure
    .input(aiChatRequestSchema)
    .mutation(({ input }) => aiChatResearch(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`ByteSer TRPC server listening at port: ${port}`);
}

start();