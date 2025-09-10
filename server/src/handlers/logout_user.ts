import { db } from '../db';
import { userSessionsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const logoutUser = async (sessionToken: string): Promise<boolean> => {
  try {
    // Delete the session from database
    const result = await db.delete(userSessionsTable)
      .where(eq(userSessionsTable.session_token, sessionToken))
      .execute();

    // Return true if a session was deleted, false if no session was found
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
};