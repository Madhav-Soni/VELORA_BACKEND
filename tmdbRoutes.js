import express from "express";
const router = express.Router();
import tmdbClient from "./utils/tmdbClient.js";
import { verifyToken } from "./middleware/verifyToken.js";

router.use(verifyToken);

router.use(async (req, res) => {
    try {
        const response = await tmdbClient.get(req.path, {
            params: req.query
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.error("TMDB Proxy Error:", error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.status_message || "Internal server error connecting to TMDB";
        res.status(status).json({ message });
    }
});

export default router;
