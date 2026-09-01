import User from "../Schema/userSchema.js";

export const watchlistController = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.status(200).json(
            user.watchlist || []
        );

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const watchlistControllerSync = async (req, res) => {
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

        user.watchlist = movieIds;

        await user.save();

        res.status(200).json({
            message: "Watchlist synced",
            watchlist: user.watchlist
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const addToWatchlistController = async (req, res) => {
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
            { $addToSet: { watchlist: movieId } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.status(200).json({
            message: "Added to watchlist",
            watchlist: user.watchlist
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const removeFromWatchlistController = async (req, res) => {
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
            { $pull: { watchlist: movieId } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.status(200).json({
            message: "Removed from watchlist",
            watchlist: user.watchlist
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};