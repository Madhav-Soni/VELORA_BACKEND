import dotenv from "dotenv";
dotenv.config();

import rateLimit from "express-rate-limit";
import RateLimitMongo from "rate-limit-mongo";

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

export const authLimiter = rateLimit({
  store: mongoUri
    ? new RateLimitMongo({
        uri: mongoUri,
        collectionName: "rateLimits",
        expireTimeMs: 15 * 60 * 1000,
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