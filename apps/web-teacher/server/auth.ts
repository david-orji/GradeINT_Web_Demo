import bcrypt from "bcryptjs";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express, Request } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/** Generates a unique teacher profile code, e.g. "TCH-A7F2K1" */
export async function generateProfileCode(): Promise<string> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    let unique = false;

    while (!unique) {
        code = "TCH-";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // ensure uniqueness against DB
        const [existing] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.profileCode, code));
        if (!existing) unique = true;
    }
    return code;
}

/** Strip passwordHash before sending user data to the client */
export function sanitizeUser(user: schema.User): schema.SafeUser {
    const { passwordHash, ...safe } = user;
    return safe;
}

// ── Passport setup ────────────────────────────────────────────────────────────

export function setupPassport(app: Express) {
    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                const [user] = await db
                    .select()
                    .from(schema.users)
                    .where(eq(schema.users.username, username));

                if (!user) return done(null, false, { message: "Invalid username or password" });

                const valid = await verifyPassword(password, user.passwordHash);
                if (!valid) return done(null, false, { message: "Invalid username or password" });

                if (user.status === "suspended") {
                    return done(null, false, { message: "Your account has been suspended." });
                }

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        })
    );

    passport.serializeUser((user: any, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
        try {
            const [user] = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, id));
            done(null, user || null);
        } catch (err) {
            done(err);
        }
    });

    app.use(passport.initialize());
    app.use(passport.session());
}
