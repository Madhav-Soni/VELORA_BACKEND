import User from "../Schema/userSchema.js";
import tmdbClient from "../utils/tmdbClient.js";
import { genreMap } from "../constants/genreMap.js";

export const recommendationController = async (req, res) => {
    try {
        const { userId } = req.params;

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

        // Signal collection with weights
        const signalMap = new Map(); // movieId -> { weight, timestamp }

        // user.favorites -> weight 3
        (user.favorites || []).forEach(id => {
            const numId = Number(id);
            if (numId) signalMap.set(numId, { weight: 3, timestamp: 0 });
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

        // Fetch genres & actors for signal movies via TMDB client
        const movieCache = new Map();
        if (topSignals.length > 0) {
            const tmdbFetches = topSignals.map(signal =>
                tmdbClient.get(`/movie/${signal.movieId}`, {
                    params: { append_to_response: "credits" }
                }).then(res => ({ id: signal.movieId, data: res.data })).catch(err => {
                    console.error(`Error fetching movie ${signal.movieId} from TMDB:`, err.message);
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
            }
        }

        // Build weighted score maps
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

        // Preserve cold-start behavior
        if (genreScores.size === 0 && actorScores.size === 0) {
            return res.status(200).json([]);
        }

        // Select top 4 genres and top 4 actors by score
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

        // Query TMDB discover using shared tmdbClient
        const fetchPromises = [];

        if (genreIds.length > 0) {
            fetchPromises.push(
                tmdbClient.get("/discover/movie", {
                    params: {
                        with_genres: genreIds.join("|"),
                        sort_by: "popularity.desc"
                    }
                })
            );
        }

        if (actorIds.length > 0) {
            fetchPromises.push(
                tmdbClient.get("/discover/movie", {
                    params: {
                        with_people: actorIds.join("|"),
                        sort_by: "popularity.desc"
                    }
                })
            );
        }

        const responses = await Promise.all(fetchPromises);

        // Merge, deduplicate, and exclude already interacted movies
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