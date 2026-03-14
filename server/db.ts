import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let dbInstance: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!dbInstance && process.env.DATABASE_URL) {
    try {
      dbInstance = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      dbInstance = null;
    }
  }
  return dbInstance;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const insertValues: InsertUser = {
      openId: user.openId,
    };
    const fieldsToUpdate: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullableField = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      insertValues[field] = normalized;
      fieldsToUpdate[field] = normalized;
    };

    textFields.forEach(assignNullableField);

    if (user.lastSignedIn !== undefined) {
      insertValues.lastSignedIn = user.lastSignedIn;
      fieldsToUpdate.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      insertValues.role = user.role;
      fieldsToUpdate.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      insertValues.role = "admin";
      fieldsToUpdate.role = "admin";
    }

    if (!insertValues.lastSignedIn) {
      insertValues.lastSignedIn = new Date();
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      fieldsToUpdate.lastSignedIn = new Date();
    }

    await db.insert(users).values(insertValues).onDuplicateKeyUpdate({
      set: fieldsToUpdate,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
