import { db } from './db';

// Session type — the Session table is managed directly in SQLite
// (not in the Prisma schema since it's only used for auth)
export interface Session {
  id: number;
  token: string;
  username: string;
  expiresAt: Date;
}

export async function createSession(username: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.session.create({
    data: {
      token,
      username,
      expiresAt,
    },
  });

  return token;
}

export async function validateSession(token: string): Promise<Session | null> {
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
  });

  if (!session) return null;
  if (new Date() > session.expiresAt) {
    await db.session.delete({ where: { token } });
    return null;
  }

  return session;
}

export async function deleteSession(token: string): Promise<void> {
  try {
    await db.session.delete({ where: { token } });
  } catch {
    // Session might not exist
  }
}

export async function cleanExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}
