import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserProfile = async (userId: number): Promise<User | null> => {
  try {
    // Query user by ID
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    // Return null if user not found
    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    
    // Return user data (password_hash is already nullable and handled)
    return {
      ...user
    };
  } catch (error) {
    console.error('Get user profile failed:', error);
    throw error;
  }
};