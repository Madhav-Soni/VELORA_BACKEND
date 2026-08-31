import dotenv from "dotenv";
dotenv.config();

import rateLimit from "express-rate-limit";
import RateLimitMongo from "rate-limit-mongo";

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

export const authLimiter = rateLimit({
  // Skip rate-limiting for CORS OPTIONS preflight requests
  skip: (req) => req.method === "OPTIONS",

  store: mongoUri
    ? new RateLimitMongo({
        uri: mongoUri,
        collectionName: "rateLimits",
        expireTimeMs: 15 * 60 * 1000,
        errorHandler: (req, res, next, err) => {
          console.error("RateLimitMongo Store Error:", err);
          next(); // Pass request through if rate limit store fails
        }
      })
    : undefined,

  windowMs: 15 * 60 * 1000,

  max: 10,

  message: {
    message: "Too many requests. Try again later.",
  },

  standardHeaders: true,
  legacyHeaders: false,
});