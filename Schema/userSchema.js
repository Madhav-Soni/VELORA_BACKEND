import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    // Required only for normal email/password accounts.
    // Google users won't have a password.
    password: {
        type: String,
        required: false
    },

    // Google account's unique identifier
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },

    // How the user authenticated
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },

    profilePicture: {
        type: String,
        default: null
    },

    favoriteActors: [
        {
            id: Number,
            name: String,
            profile_path: String,
        }
    ],

    favoriteGenres: {
        type: [String],
        default: []
    },

    watchlist: {
        type: [Number],
        default: []
    },

    favorites: {
        type: [Number],
        default: []
    },

    watchHistory: [
        {
            movieId: Number,
            watchedAt: Date,
        },
    ],

    ratings: [
        {
            movieId: Number,
            rating: Number,
        },
    ],

    selectedMood: {
        type: String,
        default: null
    }
});

const User = mongoose.model('User', userSchema);

export default User;