import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUserProfile } from '../handlers/get_user_profile';
import { eq } from 'drizzle-orm';

describe('getUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user profile when user exists', async () => {
    // Create test user
    const testUser = {
      email: 'test@example.com',
      password_hash: 'hashed_password_123',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      google_id: null,
      is_active: true
    };

    const insertResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    // Verify profile data
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.email).toEqual('test@example.com');
    expect(result!.display_name).toEqual('Test User');
    expect(result!.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result!.google_id).toBeNull();
    expect(result!.is_active).toBe(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    
    // Verify password hash is included (it's part of the schema)
    expect(result!.password_hash).toEqual('hashed_password_123');
  });

  it('should return null when user does not exist', async () => {
    const result = await getUserProfile(999);
    expect(result).toBeNull();
  });

  it('should return user with null password_hash for OAuth users', async () => {
    // Create OAuth user without password
    const oauthUser = {
      email: 'oauth@example.com',
      password_hash: null,
      display_name: 'OAuth User',
      avatar_url: 'https://example.com/oauth-avatar.jpg',
      google_id: 'google_123456',
      is_active: true
    };

    const insertResult = await db.insert(usersTable)
      .values(oauthUser)
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    // Verify OAuth user data
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.email).toEqual('oauth@example.com');
    expect(result!.password_hash).toBeNull();
    expect(result!.google_id).toEqual('google_123456');
    expect(result!.display_name).toEqual('OAuth User');
  });

  it('should return inactive user profile', async () => {
    // Create inactive user
    const inactiveUser = {
      email: 'inactive@example.com',
      password_hash: 'hashed_password_456',
      display_name: 'Inactive User',
      avatar_url: null,
      google_id: null,
      is_active: false
    };

    const insertResult = await db.insert(usersTable)
      .values(inactiveUser)
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    // Verify inactive user is still returned
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.is_active).toBe(false);
    expect(result!.display_name).toEqual('Inactive User');
  });

  it('should handle user with minimal data', async () => {
    // Create user with minimal required fields
    const minimalUser = {
      email: 'minimal@example.com',
      password_hash: null,
      display_name: 'M',
      avatar_url: null,
      google_id: null,
      is_active: true
    };

    const insertResult = await db.insert(usersTable)
      .values(minimalUser)
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Get user profile
    const result = await getUserProfile(createdUser.id);

    // Verify minimal data is handled correctly
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.email).toEqual('minimal@example.com');
    expect(result!.display_name).toEqual('M');
    expect(result!.avatar_url).toBeNull();
    expect(result!.password_hash).toBeNull();
    expect(result!.google_id).toBeNull();
  });

  it('should verify database consistency', async () => {
    // Create test user
    const testUser = {
      email: 'consistency@example.com',
      password_hash: 'test_hash',
      display_name: 'Consistency Test',
      avatar_url: null,
      google_id: null,
      is_active: true
    };

    const insertResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Get profile via handler
    const profileResult = await getUserProfile(createdUser.id);

    // Query database directly for comparison
    const directQuery = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, createdUser.id))
      .execute();

    // Verify handler returns same data as direct query
    expect(profileResult).not.toBeNull();
    expect(directQuery).toHaveLength(1);
    
    const directUser = directQuery[0];
    expect(profileResult!.id).toEqual(directUser.id);
    expect(profileResult!.email).toEqual(directUser.email);
    expect(profileResult!.display_name).toEqual(directUser.display_name);
    expect(profileResult!.created_at.getTime()).toEqual(directUser.created_at.getTime());
    expect(profileResult!.updated_at.getTime()).toEqual(directUser.updated_at.getTime());
  });
});