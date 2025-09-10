import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userSessionsTable } from '../db/schema';
import { logoutUser } from '../handlers/logout_user';
import { eq } from 'drizzle-orm';

describe('logoutUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should logout user with valid session token', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        password_hash: 'hashedpassword123',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a session for the user
    const sessionResult = await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: 'valid_session_token_123',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      })
      .returning()
      .execute();

    const session = sessionResult[0];

    // Logout the user
    const result = await logoutUser('valid_session_token_123');

    // Should return true indicating successful logout
    expect(result).toBe(true);

    // Verify session was deleted from database
    const sessions = await db.select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.session_token, 'valid_session_token_123'))
      .execute();

    expect(sessions).toHaveLength(0);
  });

  it('should return false for invalid session token', async () => {
    // Try to logout with non-existent session token
    const result = await logoutUser('invalid_session_token');

    // Should return false indicating no session was found
    expect(result).toBe(false);
  });

  it('should return false for empty session token', async () => {
    // Try to logout with empty session token
    const result = await logoutUser('');

    // Should return false indicating no session was found
    expect(result).toBe(false);
  });

  it('should not affect other sessions', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        display_name: 'User One',
        password_hash: 'hashedpassword123',
        is_active: true
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        display_name: 'User Two',
        password_hash: 'hashedpassword456',
        is_active: true
      })
      .returning()
      .execute();

    const user1 = user1Result[0];
    const user2 = user2Result[0];

    // Create sessions for both users
    await db.insert(userSessionsTable)
      .values([
        {
          user_id: user1.id,
          session_token: 'user1_session_token',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        {
          user_id: user2.id,
          session_token: 'user2_session_token',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      ])
      .execute();

    // Logout user1
    const result = await logoutUser('user1_session_token');
    expect(result).toBe(true);

    // Verify user1's session was deleted
    const user1Sessions = await db.select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.session_token, 'user1_session_token'))
      .execute();

    expect(user1Sessions).toHaveLength(0);

    // Verify user2's session still exists
    const user2Sessions = await db.select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.session_token, 'user2_session_token'))
      .execute();

    expect(user2Sessions).toHaveLength(1);
    expect(user2Sessions[0].user_id).toBe(user2.id);
  });

  it('should handle expired sessions correctly', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        password_hash: 'hashedpassword123',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create an expired session
    await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: 'expired_session_token',
        expires_at: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago (expired)
      })
      .execute();

    // Logout with expired session token
    const result = await logoutUser('expired_session_token');

    // Should still return true and delete the expired session
    expect(result).toBe(true);

    // Verify expired session was deleted
    const sessions = await db.select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.session_token, 'expired_session_token'))
      .execute();

    expect(sessions).toHaveLength(0);
  });
});