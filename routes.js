import express from "express";
const router = express.Router();

//middleware
import { verifyToken } from "./middleware/verifyToken.js";
import { requireOwnership } from "./middleware/requireOwnership.js";
import { authLimiter } from "./middleware/limiter.js";
import { loginValidation, signupValidation, handleValidationErrors } from "./middleware/validation.js";

//auth
import { signupController } from "./auth/signup.js";
import { loginController } from "./auth/login.js";
import { googleLoginController } from "./auth/googleAuth.js";
router.post("/signup", authLimiter, signupValidation, handleValidationErrors, signupController);
router.post("/login", authLimiter, loginValidation, handleValidationErrors, loginController);
router.post("/google", googleLoginController);

//recommendationRoutes
import { recommendationController } from "./recommendation/recommendationController.js";
router.get("/recommendations/:userId", verifyToken, requireOwnership, recommendationController);

//watchlistRoutes
import { watchlistController, watchlistControllerSync } from "./watchlist/watchlistController.js";
router.get("/watchlist/:userId", verifyToken, requireOwnership, watchlistController);
router.post("/watchlist-sync/:userId", verifyToken, requireOwnership, watchlistControllerSync);

//favoritesRoutes
import { favoritesController, favoritesControllerSync } from "./favorites/favoritesController.js";
router.get("/favorites/:userId", verifyToken, requireOwnership, favoritesController);
router.post("/favorites-sync/:userId", verifyToken, requireOwnership, favoritesControllerSync);

// historyRoutes
import { getWatchHistory, historyController } from "./history/historyController.js";
router.get("/watch-history/:userId", verifyToken, requireOwnership, getWatchHistory);
router.post("/watched/:userId", verifyToken, requireOwnership, historyController);

//preferenceRoutes
import { getPreferenceController, preferenceController } from "./preferences/preferenceController.js";
router.get("/preferences/:userId", verifyToken, requireOwnership, getPreferenceController);
router.put("/preferences/:userId", verifyToken, requireOwnership, preferenceController);

export default router;