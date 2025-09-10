import { type LoginInput, type UserSession } from '../schema';

export async function loginUser(input: LoginInput): Promise<UserSession> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is authenticating user with email/password.
    // Should verify password hash, create session token, and return session data.
    return Promise.resolve({
        id: 1,
        user_id: 1,
        session_token: 'placeholder_session_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        created_at: new Date()
    } as UserSession);
}