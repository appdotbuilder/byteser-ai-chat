import { db } from '../db';
import { userSessionsTable, usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq, and, gt } from 'drizzle-orm';

export async function validateSession(sessionToken: string): Promise<User | null> {
  try {
    // Query for the session with associated user data
    const result = await db.select()
      .from(userSessionsTable)
      .innerJoin(usersTable, eq(userSessionsTable.user_id, usersTable.id))
      .where(
        and(
          eq(userSessionsTable.session_token, sessionToken),
          gt(userSessionsTable.expires_at, new Date()), // Session must not be expired
          eq(usersTable.is_active, true) // User must be active
        )
      )
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Return the user data from the joined result
    const userData = result[0].users;
    return {
      id: userData.id,
      email: userData.email,
      password_hash: userData.password_hash,
      display_name: userData.display_name,
      avatar_url: userData.avatar_url,
      google_id: userData.google_id,
      is_active: userData.is_active,
      created_at: userData.created_at,
      updated_at: userData.updated_at
    };
  } catch (error) {
    console.error('Session validation failed:', error);
    throw error;
  }
}