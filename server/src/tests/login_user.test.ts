import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userSessionsTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { eq } from 'drizzle-orm';

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test user
  const createTestUser = async (overrides = {}) => {
    const defaultUser = {
      email: 'test@example.com',
      password_hash: 'test_password',
      display_name: 'Test User',
      avatar_url: null,
      google_id: null,
      is_active: true
    };

    const result = await db.insert(usersTable)
      .values({ ...defaultUser, ...overrides })
      .returning()
      .execute();

    return result[0];
  };

  it('should login with valid credentials', async () => {
    // Create test user
    const user = await createTestUser();

    const input: LoginInput = {
      email: 'test@example.com',
      password: 'test_password'
    };

    const session = await loginUser(input);

    // Verify session properties
    expect(session.id).toBeDefined();
    expect(session.user_id).toEqual(user.id);
    expect(session.session_token).toBeDefined();
    expect(typeof session.session_token).toBe('string');
    expect(session.session_token.length).toBeGreaterThan(0);
    expect(session.expires_at).toBeInstanceOf(Date);
    expect(session.created_at).toBeInstanceOf(Date);

    // Verify expiration is approximately 24 hours from now
    const now = new Date();
    const expectedExpiration = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(session.expires_at.getTime() - expectedExpiration.getTime());
    expect(timeDiff).toBeLessThan(60000); // Within 1 minute tolerance
  });

  it('should save session to database', async () => {
    // Create test user
    const user = await createTestUser();

    const input: LoginInput = {
      email: 'test@example.com',
      password: 'test_password'
    };

    const session = await loginUser(input);

    // Verify session was saved to database
    const sessions = await db.select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.id, session.id))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].user_id).toEqual(user.id);
    expect(sessions[0].session_token).toEqual(session.session_token);
    expect(sessions[0].expires_at).toEqual(session.expires_at);
  });

  it('should throw error for invalid email', async () => {
    // Create test user
    await createTestUser();

    const input: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'test_password'
    };

    await expect(loginUser(input)).rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for invalid password', async () => {
    // Create test user
    await createTestUser();

    const input: LoginInput = {
      email: 'test@example.com',
      password: 'wrong_password'
    };

    await expect(loginUser(input)).rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for inactive user', async () => {
    // Create inactive test user
    await createTestUser({ is_active: false });

    const input: LoginInput = {
      email: 'test@example.com',
      password: 'test_password'
    };

    await expect(loginUser(input)).rejects.toThrow(/user account is deactivated/i);
  });

  it('should throw error for OAuth-only user (no password hash)', async () => {
    // Create Google OAuth user (no password hash)
    await createTestUser({ 
      password_hash: null,
      google_id: 'google123' 
    });

    const input: LoginInput = {
      email: 'test@example.com',
      password: 'any_password'
    };

    await expect(loginUser(input)).rejects.toThrow(/uses google sign-in/i);
  });

  it('should generate unique session tokens', async () => {
    // Create test user
    await createTestUser();

    const input: LoginInput = {
      email: 'test@example.com',
      password: 'test_password'
    };

    // Create multiple sessions
    const session1 = await loginUser(input);
    const session2 = await loginUser(input);

    // Verify tokens are different
    expect(session1.session_token).not.toEqual(session2.session_token);
    expect(session1.id).not.toEqual(session2.id);
  });

  it('should handle case-sensitive email', async () => {
    // Create test user with lowercase email
    await createTestUser({ email: 'test@example.com' });

    const input: LoginInput = {
      email: 'TEST@EXAMPLE.COM',
      password: 'test_password'
    };

    // Should fail because email is case-sensitive
    await expect(loginUser(input)).rejects.toThrow(/invalid email or password/i);
  });
});