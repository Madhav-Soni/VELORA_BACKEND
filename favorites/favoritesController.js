import User from "../Schema/userSchema.js";

export const favoritesController = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
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
        const { movieIds } = req.body;

        if (!Array.isArray(movieIds) || !movieIds.every(id => typeof id === "number" && !isNaN(id))) {
            return res.status(400).json({
                message: "movieIds must be an array of numbers"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
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

export const addToFavoritesController = async (req, res) => {
    try {
        const { userId } = req.params;
        const { movieId } = req.body;

        if (typeof movieId !== "number" || isNaN(movieId)) {
            return res.status(400).json({
                message: "movieId must be a number"
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { favorites: movieId } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.status(200).json({
            message: "Added to favorites",
            favorites: user.favorites
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const removeFromFavoritesController = async (req, res) => {
    try {
        const { userId } = req.params;
        const { movieId } = req.body;

        if (typeof movieId !== "number" || isNaN(movieId)) {
            return res.status(400).json({
                message: "movieId must be a number"
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { favorites: movieId } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.status(200).json({
            message: "Removed from favorites",
            favorites: user.favorites
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};
