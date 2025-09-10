import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userSessionsTable } from '../db/schema';
import { validateSession } from '../handlers/validate_session';

describe('validateSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user for valid session token', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        google_id: null,
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a valid session (expires in 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: 'valid_token_123',
        expires_at: expiresAt
      })
      .execute();

    // Validate the session
    const result = await validateSession('valid_token_123');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(user.id);
    expect(result!.email).toBe('test@example.com');
    expect(result!.display_name).toBe('Test User');
    expect(result!.avatar_url).toBe('https://example.com/avatar.jpg');
    expect(result!.password_hash).toBe('hashed_password');
    expect(result!.google_id).toBeNull();
    expect(result!.is_active).toBe(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent session token', async () => {
    const result = await validateSession('non_existent_token');
    expect(result).toBeNull();
  });

  it('should return null for expired session token', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        display_name: 'Test User',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create an expired session (expired 1 hour ago)
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() - 1);

    await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: 'expired_token_123',
        expires_at: expiredAt
      })
      .execute();

    // Validate the expired session
    const result = await validateSession('expired_token_123');
    expect(result).toBeNull();
  });

  it('should return null for inactive user session', async () => {
    // Create an inactive user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'inactive@example.com',
        password_hash: 'hashed_password',
        display_name: 'Inactive User',
        is_active: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a valid session for the inactive user
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: 'inactive_user_token',
        expires_at: expiresAt
      })
      .execute();

    // Validate the session for inactive user
    const result = await validateSession('inactive_user_token');
    expect(result).toBeNull();
  });

  it('should return user with Google OAuth data', async () => {
    // Create a Google OAuth user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'google@example.com',
        password_hash: null, // No password for Google OAuth users
        display_name: 'Google User',
        avatar_url: 'https://lh3.googleusercontent.com/avatar.jpg',
        google_id: 'google_oauth_id_123',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a valid session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: 'google_user_token',
        expires_at: expiresAt
      })
      .execute();

    // Validate the session
    const result = await validateSession('google_user_token');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(user.id);
    expect(result!.email).toBe('google@example.com');
    expect(result!.display_name).toBe('Google User');
    expect(result!.password_hash).toBeNull();
    expect(result!.google_id).toBe('google_oauth_id_123');
    expect(result!.avatar_url).toBe('https://lh3.googleusercontent.com/avatar.jpg');
    expect(result!.is_active).toBe(true);
  });

  it('should handle session validation at exact expiry time', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        display_name: 'Test User',
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a session that expires right now (should be invalid)
    const now = new Date();

    await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: 'exactly_now_token',
        expires_at: now
      })
      .execute();

    // Wait a tiny bit to ensure we're past the expiry time
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await validateSession('exactly_now_token');
    expect(result).toBeNull();
  });
});