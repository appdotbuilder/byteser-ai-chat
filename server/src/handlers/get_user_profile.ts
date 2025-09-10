import { type User } from '../schema';

export async function getUserProfile(userId: number): Promise<User | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching user profile data by user ID.
    // Should return user data without sensitive information like password hash.
    return Promise.resolve({
        id: userId,
        email: 'user@example.com',
        password_hash: null, // Don't return password hash in profile
        display_name: 'User Name',
        avatar_url: null,
        google_id: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
    } as User);
}