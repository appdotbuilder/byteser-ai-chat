import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Check if user with this email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password if provided (for regular signup)
    let password_hash: string | null = null;
    if (input.password) {
      const salt = randomBytes(16).toString('hex');
      const hash = pbkdf2Sync(input.password, salt, 10000, 64, 'sha512').toString('hex');
      password_hash = `${salt}:${hash}`;
    }

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        display_name: input.display_name,
        avatar_url: input.avatar_url || null,
        google_id: input.google_id || null,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};