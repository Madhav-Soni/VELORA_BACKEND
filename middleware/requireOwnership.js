import mongoose from "mongoose";

export const requireOwnership = (req, res, next) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            message: "Invalid user ID"
        });
    }

    if (req.user._id.toString() !== userId.toString()) {
        return res.status(403).json({
            message: "Unauthorized access"
        });
    }

    next();
};
