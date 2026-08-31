import mongoose from "mongoose";
import User from "../Schema/userSchema.js";

export const favoritesController = async (req, res) => {
    try {

        const { userId } = req.params;

        if (
            !mongoose.Types.ObjectId.isValid(userId)
        ) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (
            req.user._id.toString() !==
            user._id.toString()
        ) {
            return res.status(403).json({
                message: "Unauthorized access"
            });
        }

        res.status(200).json(
            user.favorites || []
        );

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const favoritesControllerSync = async (req, res) => {
    try {

        const { userId } = req.params;

        if (
            !mongoose.Types.ObjectId.isValid(userId)
        ) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const { movieIds } = req.body;

        if (!Array.isArray(movieIds)) {
            return res.status(400).json({
                message: "movieIds must be an array"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (
            req.user._id.toString() !==
            user._id.toString()
        ) {
            return res.status(403).json({
                message: "Unauthorized access"
            });
        }

        user.favorites = movieIds;

        await user.save();

        res.status(200).json({
            message: "Favorites synced",
            favorites: user.favorites
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};
