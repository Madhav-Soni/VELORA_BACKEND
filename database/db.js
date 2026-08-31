import mongoose from 'mongoose';
import dotenv from "dotenv";
dotenv.config();

const dbconnect = () => {
  const url = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!url) {
    console.error("MongoDB connection failed: Neither MONGODB_URI nor MONGO_URI is defined in .env");
    process.exit(1);
  }
  mongoose.connect(url).then(() => console.log("MongoDB connected"))
    .catch((err) => {
      console.log("MongoDB connection failed", err);
      process.exit(1);
    });
};

export default dbconnect;