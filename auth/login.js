import bcrypt from "bcryptjs";
import User from "../Schema/userSchema.js";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";

const GENERIC_AUTH_ERROR = "Invalid email or password";

export const loginController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errors: errors.array()
        });
    }

    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password required" });
        }

        const normalizedEmail = email.toLowerCase();
        const checkExistingUser = await User.findOne({
            email: normalizedEmail
        }).select("+password"); // in case password has `select: false` in the schema

        if (!checkExistingUser || !checkExistingUser.password) {
            // Covers: no account with this email, AND account exists but is Google-only.
            // Same generic message either way so we don't leak account existence/type.
            return res.status(400).json({ message: GENERIC_AUTH_ERROR });
        }

        const comparePassword = await bcrypt.compare(
            password,
            checkExistingUser.password
        );

        if (!comparePassword) {
            return res.status(400).json({ message: GENERIC_AUTH_ERROR });
        }

        const token = jwt.sign(
            { _id: checkExistingUser._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            message: "Login Done!!!",
            userId: checkExistingUser._id,
            name: checkExistingUser.name,
            token
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
};