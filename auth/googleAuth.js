import { OAuth2Client } from "google-auth-library";
import User from "../Schema/userSchema.js";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLoginController = async (req, res) => {
    try {
        const credential = req.body.credential || req.body.token;

        if (!credential) {
            return res.status(400).json({
                message: "Google credential required"
            });
        }

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

        let user = await User.findOne({ googleId });

        if (!user) {
            const existingLocalUser = await User.findOne({ email: normalizedEmail });

            if (existingLocalUser) {
                if (existingLocalUser.password) {
                    // Account exists and has a password set — do NOT auto-link.
                    // Force the user to prove ownership via password login first,
                    // then link Google from an authenticated "connect account" flow.
                    return res.status(409).json({
                        message:
                            "An account with this email already exists. Please log in with your password and connect Google from your account settings."
                    });
                }

                // Existing account has no password (e.g. was created via some other
                // passwordless flow) — safe to link.
                existingLocalUser.googleId = googleId;
                existingLocalUser.authProvider = "google";
                existingLocalUser.profilePicture = picture || existingLocalUser.profilePicture;

                await existingLocalUser.save();
                user = existingLocalUser;

            } else {
                user = await User.create({
                    name: name || "Google User",
                    email: normalizedEmail,
                    googleId,
                    authProvider: "google",
                    profilePicture: picture || null
                });
            }
        }

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