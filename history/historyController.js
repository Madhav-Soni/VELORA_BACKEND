import User from "../Schema/userSchema.js";

export const getWatchHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            watchHistory: user.watchHistory || []
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const historyController = async (req, res) => {
    try {
        const { movieId } = req.body;
        const { userId } = req.params;

        if (!movieId) {
            return res.status(400).json({ message: "movieId is required" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const existingEntry = user.watchHistory.find(entry => entry.movieId === movieId);
        if (existingEntry) {
            existingEntry.watchedAt = new Date();
        } else {
            user.watchHistory.push({
                movieId,
                watchedAt: new Date()
            });
        }

        await user.save();
        res.status(200).json({ message: "Watched history updated", watchHistory: user.watchHistory });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
};