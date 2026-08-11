import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  findUserByEmail(email: string): Promise<User | undefined>;
  findUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(data: { email: string; passwordHash: string; name: string }): Promise<User>;
  createGoogleUser(data: { googleId: string; email: string; name?: string | null; profileImageUrl?: string | null }): Promise<User>;
  linkGoogleId(userId: string, googleId: string): Promise<void>;
  listUsers(status?: string): Promise<User[]>;
  updateUserStatus(id: string, status: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<{ role: string; status: string; name: string }>): Promise<User | undefined>;
  updateLastLogin(id: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async findUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createGoogleUser(data: {
    googleId: string;
    email: string;
    name?: string | null;
    profileImageUrl?: string | null;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        googleId: data.googleId,
        name: data.name ?? data.email.split("@")[0],
        profileImageUrl: data.profileImageUrl ?? null,
        role: "viewer",
        status: "pending",
      })
      .returning();
    return user;
  }

  async linkGoogleId(userId: string, googleId: string): Promise<void> {
    await db
      .update(users)
      .set({ googleId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async createUser(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        role: "viewer",
        status: "pending",
      })
      .returning();
    return user;
  }

  async listUsers(status?: string): Promise<User[]> {
    if (status) {
      return db.select().from(users).where(eq(users.status, status));
    }
    return db.select().from(users);
  }

  async updateUserStatus(id: string, status: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<{ role: string; status: string; name: string }>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }
}

export const authStorage = new AuthStorage();
