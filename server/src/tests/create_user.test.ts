import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync } from 'crypto';

// Test input for regular user registration
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  display_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  google_id: undefined
};

// Test input for Google OAuth user
const googleUserInput: CreateUserInput = {
  email: 'google@example.com',
  display_name: 'Google User',
  avatar_url: 'https://example.com/google-avatar.jpg',
  google_id: 'google_123456789'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a regular user with password', async () => {
    const result = await createUser(testUserInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.display_name).toEqual('Test User');
    expect(result.avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(result.google_id).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not plain text
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123');
    expect(typeof result.password_hash).toBe('string');
  });

  it('should hash password correctly', async () => {
    const result = await createUser(testUserInput);

    // Verify password hash contains salt and hash
    expect(result.password_hash).toContain(':');
    const [salt, hash] = result.password_hash!.split(':');
    expect(salt).toBeDefined();
    expect(hash).toBeDefined();
    expect(salt.length).toEqual(32); // 16 bytes = 32 hex chars
    expect(hash.length).toEqual(128); // 64 bytes = 128 hex chars

    // Verify password can be validated
    const testHash = pbkdf2Sync('password123', salt, 10000, 64, 'sha512').toString('hex');
    expect(testHash).toEqual(hash);

    // Verify wrong password fails
    const wrongHash = pbkdf2Sync('wrongpassword', salt, 10000, 64, 'sha512').toString('hex');
    expect(wrongHash).not.toEqual(hash);
  });

  it('should create Google OAuth user without password', async () => {
    const result = await createUser(googleUserInput);

    // Basic field validation
    expect(result.email).toEqual('google@example.com');
    expect(result.display_name).toEqual('Google User');
    expect(result.avatar_url).toEqual('https://example.com/google-avatar.jpg');
    expect(result.google_id).toEqual('google_123456789');
    expect(result.password_hash).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testUserInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].display_name).toEqual('Test User');
    expect(users[0].avatar_url).toEqual('https://example.com/avatar.jpg');
    expect(users[0].is_active).toBe(true);
    expect(users[0].password_hash).toBeDefined();
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle user with minimal required fields', async () => {
    const minimalInput: CreateUserInput = {
      email: 'minimal@example.com',
      display_name: 'Minimal User'
    };

    const result = await createUser(minimalInput);

    expect(result.email).toEqual('minimal@example.com');
    expect(result.display_name).toEqual('Minimal User');
    expect(result.avatar_url).toBeNull();
    expect(result.google_id).toBeNull();
    expect(result.password_hash).toBeNull();
    expect(result.is_active).toBe(true);
  });

  it('should throw error for duplicate email', async () => {
    // Create first user
    await createUser(testUserInput);

    // Attempt to create second user with same email
    const duplicateInput: CreateUserInput = {
      email: 'test@example.com', // Same email
      display_name: 'Another User',
      password: 'differentpassword'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/already exists/i);
  });

  it('should allow different users with different emails', async () => {
    // Create first user
    const user1 = await createUser(testUserInput);

    // Create second user with different email
    const user2Input: CreateUserInput = {
      email: 'different@example.com',
      display_name: 'Different User',
      password: 'password456'
    };

    const user2 = await createUser(user2Input);

    expect(user1.id).not.toEqual(user2.id);
    expect(user1.email).not.toEqual(user2.email);

    // Verify both users exist in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
  });

  it('should handle user creation with null avatar_url explicitly', async () => {
    const nullAvatarInput: CreateUserInput = {
      email: 'nullavatar@example.com',
      display_name: 'No Avatar User',
      password: 'password789',
      avatar_url: null
    };

    const result = await createUser(nullAvatarInput);

    expect(result.avatar_url).toBeNull();
    expect(result.email).toEqual('nullavatar@example.com');
    expect(result.display_name).toEqual('No Avatar User');
  });
});