import dotenv from "dotenv";
dotenv.config();

import rateLimit from "express-rate-limit";
import RateLimitMongo from "rate-limit-mongo";

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

export const authLimiter = rateLimit({
  skip: (req) => req.method === "OPTIONS",

  store: mongoUri
    ? new RateLimitMongo({
        uri: mongoUri,
        collectionName: "rateLimits",
        expireTimeMs: 15 * 60 * 1000,
        errorHandler: (req, res, next, err) => {
          console.error("RateLimitMongo Auth Store Error:", err);
          next();
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

export const apiLimiter = rateLimit({
  skip: (req) => req.method === "OPTIONS",

  store: mongoUri
    ? new RateLimitMongo({
        uri: mongoUri,
        collectionName: "apiRateLimits",
        expireTimeMs: 15 * 60 * 1000,
        errorHandler: (req, res, next, err) => {
          console.error("RateLimitMongo API Store Error:", err);
          next();
        }
      })
    : undefined,

  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    message: "Too many requests. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});