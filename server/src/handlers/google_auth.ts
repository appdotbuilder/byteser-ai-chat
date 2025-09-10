import { db } from '../db';
import { usersTable, userSessionsTable } from '../db/schema';
import { type GoogleAuthInput, type UserSession } from '../schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const googleAuth = async (input: GoogleAuthInput): Promise<UserSession> => {
  try {
    // Check if user already exists by Google ID
    const existingUserByGoogleId = await db.select()
      .from(usersTable)
      .where(eq(usersTable.google_id, input.google_id))
      .execute();

    let user;
    
    if (existingUserByGoogleId.length > 0) {
      // User exists with Google ID, use existing user
      user = existingUserByGoogleId[0];
      
      // Update user info if changed (display name or avatar)
      if (user.display_name !== input.display_name || user.avatar_url !== input.avatar_url) {
        const updatedUsers = await db.update(usersTable)
          .set({
            display_name: input.display_name,
            avatar_url: input.avatar_url,
            updated_at: new Date()
          })
          .where(eq(usersTable.id, user.id))
          .returning()
          .execute();
        
        user = updatedUsers[0];
      }
    } else {
      // Check if user exists by email (might be existing user linking Google account)
      const existingUserByEmail = await db.select()
        .from(usersTable)
        .where(eq(usersTable.email, input.email))
        .execute();

      if (existingUserByEmail.length > 0) {
        // User exists by email, link Google account
        const updatedUsers = await db.update(usersTable)
          .set({
            google_id: input.google_id,
            display_name: input.display_name,
            avatar_url: input.avatar_url,
            updated_at: new Date()
          })
          .where(eq(usersTable.id, existingUserByEmail[0].id))
          .returning()
          .execute();
        
        user = updatedUsers[0];
      } else {
        // Create new user
        const newUsers = await db.insert(usersTable)
          .values({
            email: input.email,
            google_id: input.google_id,
            display_name: input.display_name,
            avatar_url: input.avatar_url,
            password_hash: null, // Google OAuth users don't have passwords
            is_active: true
          })
          .returning()
          .execute();
        
        user = newUsers[0];
      }
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create user session
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
    console.error('Google authentication failed:', error);
    throw error;
  }
};