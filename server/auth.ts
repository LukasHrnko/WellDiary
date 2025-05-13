import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";
import { db } from "@db";
import { users } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "@db";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      createdAt: Date;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "welldiary-session-secret",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({ 
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.username, username)
        });
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          // Omit password from user object
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id)
      });
      
      if (!user) {
        return done(null, false);
      }
      
      // Omit password from user object
      const { password: _, ...userWithoutPassword } = user;
      done(null, userWithoutPassword);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if username already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, req.body.username)
      });
      
      if (existingUser) {
        return res.status(400).json({ message: "Uživatelské jméno již existuje" });
      }
  
      // Hash password
      const hashedPassword = await hashPassword(req.body.password);
      
      // Create user
      const [user] = await db.insert(users).values({
        username: req.body.username,
        password: hashedPassword
      }).returning({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt
      });
  
      // Log user in
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Chyba při registraci" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: "Nesprávné uživatelské jméno nebo heslo" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Uživatel není přihlášen" });
    res.json(req.user);
  });
}