import User from "../Schema/userSchema.js";
import { genreMap } from "../constants/genreMap.js";

export const getPreferenceController = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            favoriteActors: user.favoriteActors,
            favoriteGenres: user.favoriteGenres,
            selectedMood: user.selectedMood
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const preferenceController = async (req, res) => {
    try {
        const { userId } = req.params;
        const { favoriteActors, favoriteGenres, selectedMood } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (favoriteActors !== undefined) {
            if (!Array.isArray(favoriteActors)) {
                return res.status(400).json({
                    message: "favoriteActors must be an array"
                });
            }

            const isValidActors = favoriteActors.every(actor =>
                actor &&
                typeof actor === "object" &&
                typeof actor.id === "number" &&
                typeof actor.name === "string" &&
                (
                    actor.profile_path === null ||
                    typeof actor.profile_path === "string"
                )
            );

            if (!isValidActors) {
                return res.status(400).json({
                    message: "Invalid actor format"
                });
            }
            user.favoriteActors = favoriteActors;
        }

        if (favoriteGenres !== undefined) {
            if (!Array.isArray(favoriteGenres) || !favoriteGenres.every(g => typeof g === "string" && g.trim() !== "" && Object.prototype.hasOwnProperty.call(genreMap, g))) {
                return res.status(400).json({
                    message: "Invalid genre in favoriteGenres"
                });
            }
            user.favoriteGenres = favoriteGenres;
        }

        if (selectedMood !== undefined) {
            user.selectedMood = selectedMood;
        }

        await user.save();
        res.status(200).json({
            message: "Preferences updated successfully",
            favoriteActors: user.favoriteActors,
            favoriteGenres: user.favoriteGenres,
            selectedMood: user.selectedMood
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
};