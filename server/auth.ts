import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

export function setupAuth(app: Express) {
  // Initialize Passport and restore authentication state from session
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          console.log("Attempting authentication for:", email);
          const user = await storage.getUserByEmail(email);
          if (!user) {
            console.log("User not found:", email);
            return done(null, false, { message: "Invalid credentials" });
          }

          const isMatch = await bcrypt.compare(password, user.passwordHash);
          if (!isMatch) {
            console.log("Password mismatch for:", email);
            return done(null, false, { message: "Invalid credentials" });
          }

          console.log("Authentication successful for:", email);
          return done(null, user);
        } catch (error) {
          console.error("Authentication error:", error);
          return done(error);
        }
      }
    )
  );

  // Tell Passport how to serialize/deserialize the user
  passport.serializeUser((user, done) => {
    console.log("Serializing user:", (user as User).id);
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("Deserializing user:", id);
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(error);
    }
  });
}

// Auth middleware for protecting routes
export function isAuthenticated(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (req.isAuthenticated()) {
    console.log("User is authenticated, proceeding...");
    return next();
  }
  console.log("Authentication required, rejecting request");
  res.status(401).json({ message: "Nicht authentifiziert" });
}