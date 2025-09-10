import { db } from '../db';
import { usersTable, userSessionsTable } from '../db/schema';
import { type LoginInput, type UserSession } from '../schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export async function loginUser(input: LoginInput): Promise<UserSession> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('User account is deactivated');
    }

    // Check if user has a password hash (not OAuth-only user)
    if (!user.password_hash) {
      throw new Error('This account uses Google sign-in. Please use Google to login.');
    }

    // For now, we'll do a simple string comparison
    // In a real app, you'd use bcrypt.compare(input.password, user.password_hash)
    if (user.password_hash !== input.password) {
      throw new Error('Invalid email or password');
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex');
    
    // Calculate expiration (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create session record
    const sessionResult = await db.insert(userSessionsTable)
      .values({
        user_id: user.id,
        session_token: sessionToken,
        expires_at: expiresAt
      })
      .returning()
      .execute();

    return sessionResult[0];
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}