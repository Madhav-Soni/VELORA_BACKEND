import { OAuth2Client } from "google-auth-library";
import User from "../Schema/userSchema.js";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLoginController = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                message: "Google credential required"
            });
        }

        // Verify Google's ID token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const {
            sub: googleId,
            email,
            name,
            picture,
            email_verified
        } = payload;

        if (!email || !email_verified) {
            return res.status(400).json({
                message: "Google email could not be verified"
            });
        }

        const normalizedEmail = email.toLowerCase();

        // First check whether this Google account already exists
        let user = await User.findOne({ googleId });

        // Google account doesn't exist yet
        if (!user) {

            // Check whether this email already belongs
            // to an existing VELORA account
            user = await User.findOne({
                email: normalizedEmail
            });

            if (user) {

                // Existing local account
                // Link Google account to it
                user.googleId = googleId;
                user.authProvider = "google";
                user.profilePicture = picture || user.profilePicture;

                await user.save();

            } else {

                // Completely new user
                user = await User.create({
                    name: name || "Google User",
                    email: normalizedEmail,
                    googleId,
                    authProvider: "google",
                    profilePicture: picture || null
                });
            }
        }

        // Generate YOUR application's JWT
        const token = jwt.sign(
            { _id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            message: "Google Login Successful",
            userId: user._id,
            name: user.name,
            token
        });

    } catch (error) {
        console.error("Google Login Error:", error);

        return res.status(500).json({
            message: "Google authentication failed"
        });
    }
};