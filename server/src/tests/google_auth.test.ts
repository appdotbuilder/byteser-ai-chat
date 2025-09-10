import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userSessionsTable } from '../db/schema';
import { type GoogleAuthInput } from '../schema';
import { googleAuth } from '../handlers/google_auth';
import { eq } from 'drizzle-orm';

// Test inputs
const googleAuthInput: GoogleAuthInput = {
  google_id: 'google_123456789',
  email: 'test@example.com',
  display_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg'
};

const googleAuthInputNoAvatar: GoogleAuthInput = {
  google_id: 'google_987654321',
  email: 'noavatar@example.com',
  display_name: 'No Avatar User',
  avatar_url: null
};

describe('googleAuth', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new user and session for first-time Google auth', async () => {
    const result = await googleAuth(googleAuthInput);

    // Verify session properties
    expect(result.id).toBeDefined();
    expect(result.user_id).toBeDefined();
    expect(result.session_token).toBeDefined();
    expect(result.session_token).toHaveLength(64); // 32 bytes hex = 64 chars
    expect(result.expires_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify user was created in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user_id))
      .execute();

    expect(users).toHaveLength(1);
    const user = users[0];
    expect(user.email).toEqual(googleAuthInput.email);
    expect(user.google_id).toEqual(googleAuthInput.google_id);
    expect(user.display_name).toEqual(googleAuthInput.display_name);
    expect(user.avatar_url).toEqual(googleAuthInput.avatar_url);
    expect(user.password_hash).toBeNull();
    expect(user.is_active).toBe(true);
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);

    // Verify session was created in database
    const sessions = await db.select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.id, result.id))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].user_id).toEqual(user.id);
    expect(sessions[0].session_token).toEqual(result.session_token);
    expect(sessions[0].expires_at).toBeInstanceOf(Date);
  });

  it('should handle Google auth with null avatar_url', async () => {
    const result = await googleAuth(googleAuthInputNoAvatar);

    // Verify user was created with null avatar
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user_id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].avatar_url).toBeNull();
    expect(users[0].google_id).toEqual(googleAuthInputNoAvatar.google_id);
  });

  it('should return existing user session for returning Google user', async () => {
    // First auth - creates user
    const firstAuth = await googleAuth(googleAuthInput);
    
    // Second auth - should use existing user
    const secondAuth = await googleAuth(googleAuthInput);

    // Should be same user but different session
    expect(secondAuth.user_id).toEqual(firstAuth.user_id);
    expect(secondAuth.session_token).not.toEqual(firstAuth.session_token);
    expect(secondAuth.id).not.toEqual(firstAuth.id);

    // Verify only one user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.google_id, googleAuthInput.google_id))
      .execute();

    expect(users).toHaveLength(1);

    // Verify two sessions exist
    const sessions = await db.select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.user_id, firstAuth.user_id))
      .execute();

    expect(sessions).toHaveLength(2);
  });

  it('should update user info for returning user with changed details', async () => {
    // First auth
    await googleAuth(googleAuthInput);

    // Second auth with updated display name and avatar
    const updatedInput: GoogleAuthInput = {
      ...googleAuthInput,
      display_name: 'Updated Test User',
      avatar_url: 'https://example.com/new-avatar.jpg'
    };

    const result = await googleAuth(updatedInput);

    // Verify user info was updated
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user_id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].display_name).toEqual('Updated Test User');
    expect(users[0].avatar_url).toEqual('https://example.com/new-avatar.jpg');
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should link Google account to existing email user', async () => {
    // Create existing user with same email but no Google ID
    const existingUsers = await db.insert(usersTable)
      .values({
        email: googleAuthInput.email,
        display_name: 'Original User',
        password_hash: 'some_hash',
        google_id: null,
        avatar_url: null,
        is_active: true
      })
      .returning()
      .execute();

    const existingUser = existingUsers[0];

    // Authenticate with Google using same email
    const result = await googleAuth(googleAuthInput);

    // Should use existing user ID
    expect(result.user_id).toEqual(existingUser.id);

    // Verify user was updated with Google info
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, existingUser.id))
      .execute();

    expect(users).toHaveLength(1);
    const updatedUser = users[0];
    expect(updatedUser.google_id).toEqual(googleAuthInput.google_id);
    expect(updatedUser.display_name).toEqual(googleAuthInput.display_name);
    expect(updatedUser.avatar_url).toEqual(googleAuthInput.avatar_url);
    expect(updatedUser.password_hash).toEqual('some_hash'); // Should preserve existing password
    expect(updatedUser.updated_at).toBeInstanceOf(Date);

    // Verify only one user exists with this email
    const allUsersWithEmail = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, googleAuthInput.email))
      .execute();

    expect(allUsersWithEmail).toHaveLength(1);
  });

  it('should generate unique session tokens', async () => {
    // Create multiple sessions
    const session1 = await googleAuth(googleAuthInput);
    const session2 = await googleAuth({ ...googleAuthInput, google_id: 'different_google_id' });

    expect(session1.session_token).not.toEqual(session2.session_token);
    expect(session1.session_token).toHaveLength(64);
    expect(session2.session_token).toHaveLength(64);
  });

  it('should set session expiry to 24 hours from now', async () => {
    const beforeAuth = new Date();
    const result = await googleAuth(googleAuthInput);
    const afterAuth = new Date();

    // Session should expire approximately 24 hours from now
    const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(result.expires_at.getTime() - expectedExpiry.getTime());
    
    // Allow for small timing differences (should be within 5 seconds)
    expect(timeDiff).toBeLessThan(5000);
    
    // Verify expiry is in the future
    expect(result.expires_at.getTime()).toBeGreaterThan(afterAuth.getTime());
  });
});