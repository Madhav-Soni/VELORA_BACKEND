import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { apiLimiter } from "./middleware/limiter.js";
dotenv.config();

const app = express();
app.use(cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"].filter(Boolean),
    credentials: true
}));

app.use(express.json({ limit: '10kb' }));

const PORT = process.env.PORT || 3000;

import dbconnect from "./database/db.js";
dbconnect();

import routes from "./routes.js";
import tmdbRoutes from "./tmdbRoutes.js";

app.use("/api", apiLimiter);
app.use("/api", routes);
app.use("/api/tmdb", tmdbRoutes);

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});