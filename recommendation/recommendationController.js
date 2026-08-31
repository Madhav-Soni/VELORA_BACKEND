import axios from "axios";
import User from "../Schema/userSchema.js";
import Movie from "../Schema/movieSchema.js";
import mongoose from "mongoose";

const genreMap = {
    "Action": 28,
    "Adventure": 12,
    "Animation": 16,
    "Comedy": 35,
    "Crime": 80,
    "Documentary": 99,
    "Drama": 18,
    "Family": 10751,
    "Fantasy": 14,
    "History": 36,
    "Horror": 27,
    "Music": 10402,
    "Mystery": 9648,
    "Romance": 10749,
    "Science Fiction": 878,
    "Sci-Fi": 878,
    "SciFi": 878,
    "TV Movie": 10770,
    "Thriller": 53,
    "War": 10752,
    "Western": 37
};

export const recommendationController = async (req, res) => {
    try {
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

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Gather all interacted movie IDs to exclude from final recommendations
        const interactedMovieIds = new Set();
        (user.favorites || []).forEach(id => interactedMovieIds.add(Number(id)));
        (user.watchlist || []).forEach(id => interactedMovieIds.add(Number(id)));
        (user.watchHistory || []).forEach(item => {
            const id = typeof item === "number" ? item : item?.movieId;
            if (id) interactedMovieIds.add(Number(id));
        });

        // 2a. Signal collection with weights
        const signalMap = new Map(); // movieId -> { weight, timestamp }

        // user.favorites -> weight 3
        (user.favorites || []).forEach(id => {
            const numId = Number(id);
            if (numId) signalMap.set(numId, { weight: 3, timestamp: 0 });
        });

        // user.ratings >= 4 -> weight 3 (ratings <= 2 ignored)
        (user.ratings || []).forEach(item => {
            if (item && item.rating >= 4 && item.movieId) {
                const numId = Number(item.movieId);
                const existing = signalMap.get(numId);
                const weight = 3;
                if (!existing || existing.weight < weight) {
                    signalMap.set(numId, { weight, timestamp: existing?.timestamp || 0 });
                }
            }
        });

        // user.watchlist -> weight 2
        (user.watchlist || []).forEach(id => {
            const numId = Number(id);
            if (numId) {
                const existing = signalMap.get(numId);
                if (!existing) {
                    signalMap.set(numId, { weight: 2, timestamp: 0 });
                } else {
                    signalMap.set(numId, { weight: Math.max(existing.weight, 2), timestamp: existing.timestamp });
                }
            }
        });

        // user.watchHistory -> weight 1
        (user.watchHistory || []).forEach(item => {
            const numId = typeof item === "number" ? Number(item) : Number(item?.movieId);
            const ts = item?.watchedAt ? new Date(item.watchedAt).getTime() : 0;
            if (numId) {
                const existing = signalMap.get(numId);
                if (!existing) {
                    signalMap.set(numId, { weight: 1, timestamp: ts });
                } else {
                    signalMap.set(numId, { weight: Math.max(existing.weight, 1), timestamp: Math.max(existing.timestamp, ts) });
                }
            }
        });

        // Cap at 30 unique signal movie IDs (favoring most recent watchedAt)
        const signalList = Array.from(signalMap.entries()).map(([movieId, info]) => ({
            movieId,
            weight: info.weight,
            timestamp: info.timestamp
        }));

        signalList.sort((a, b) => (b.timestamp - a.timestamp) || (b.weight - a.weight));
        const topSignals = signalList.slice(0, 30);

        // 2b. Resolve genres/actors for each signal movie ID
        const signalIds = topSignals.map(s => s.movieId);
        const localMovies = signalIds.length > 0 ? await Movie.find({ tmdbId: { $in: signalIds } }) : [];

        const movieCache = new Map();
        localMovies.forEach(m => {
            movieCache.set(m.tmdbId, {
                genres: m.genres || [],
                actors: m.actors || []
            });
        });

        const missingIds = signalIds.filter(id => !movieCache.has(id));

        if (missingIds.length > 0) {
            const tmdbFetches = missingIds.map(id =>
                axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
                    params: {
                        api_key: process.env.TMDB_API_KEY,
                        append_to_response: "credits"
                    }
                }).then(res => ({ id, data: res.data })).catch(err => {
                    console.error(`Error fetching movie ${id} from TMDB:`, err.message);
                    return null;
                })
            );

            const fetchedResults = await Promise.all(tmdbFetches);

            for (const item of fetchedResults) {
                if (!item || !item.data) continue;
                const data = item.data;
                const genreNames = (data.genres || []).map(g => g.name);
                const actorIds = (data.credits?.cast || []).slice(0, 5).map(c => c.id);

                movieCache.set(item.id, {
                    genres: genreNames,
                    actors: actorIds
                });

                // Upsert newly fetched movie into local collection
                Movie.create({
                    tmdbId: item.id,
                    title: data.title,
                    genres: genreNames,
                    actors: actorIds,
                    rating: data.vote_average,
                    popularity: data.popularity
                }).catch(() => {});
            }
        }

        // 2c. Build weighted score maps
        const genreScores = new Map();
        const actorScores = new Map();

        for (const signal of topSignals) {
            const info = movieCache.get(signal.movieId);
            if (!info) continue;

            (info.genres || []).forEach(g => {
                genreScores.set(g, (genreScores.get(g) || 0) + signal.weight);
            });

            (info.actors || []).forEach(actorId => {
                actorScores.set(actorId, (actorScores.get(actorId) || 0) + signal.weight);
            });
        }

        // Fold in onboarding static signals at weight 1 each
        (user.favoriteGenres || []).forEach(g => {
            if (g) genreScores.set(g, (genreScores.get(g) || 0) + 1);
        });

        (user.favoriteActors || []).forEach(actorObj => {
            const actorId = typeof actorObj === "number" ? actorObj : actorObj?.id;
            if (actorId) actorScores.set(actorId, (actorScores.get(actorId) || 0) + 1);
        });

        // 2f. Preserve cold-start behavior
        if (genreScores.size === 0 && actorScores.size === 0) {
            return res.status(200).json([]);
        }

        // 2d. Select top 4 genres and top 4 actors by score
        const topGenres = Array.from(genreScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(e => e[0]);

        const topActors = Array.from(actorScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(e => e[0]);

        const genreIds = topGenres.map(g => genreMap[g]).filter(Boolean);
        const actorIds = topActors.filter(Boolean);

        if (genreIds.length === 0 && actorIds.length === 0) {
            return res.status(200).json([]);
        }

        // Query TMDB discover
        const fetchPromises = [];

        if (genreIds.length > 0) {
            fetchPromises.push(
                axios.get("https://api.themoviedb.org/3/discover/movie", {
                    params: {
                        api_key: process.env.TMDB_API_KEY,
                        with_genres: genreIds.join("|"),
                        sort_by: "popularity.desc"
                    }
                })
            );
        }

        if (actorIds.length > 0) {
            fetchPromises.push(
                axios.get("https://api.themoviedb.org/3/discover/movie", {
                    params: {
                        api_key: process.env.TMDB_API_KEY,
                        with_people: actorIds.join("|"),
                        sort_by: "popularity.desc"
                    }
                })
            );
        }

        const responses = await Promise.all(fetchPromises);

        // Merge, deduplicate, and exclude already interacted movies (2e)
        const allMovies = responses.flatMap(r => r.data.results);
        const movieMap = new Map();

        allMovies.forEach(movie => {
            if (movie && movie.id && !movieMap.has(movie.id) && !interactedMovieIds.has(movie.id)) {
                movieMap.set(movie.id, movie);
            }
        });

        const uniqueMovies = Array.from(movieMap.values());

        // Sort by popularity and take top 20
        const sortedMovies = uniqueMovies
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 20);

        return res.status(200).json(sortedMovies);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};