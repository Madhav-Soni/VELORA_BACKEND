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

        // Interacted movies set to exclude from final recommendations
        const interactedMovieIds = new Set();
        (user.favorites || []).forEach(id => interactedMovieIds.add(Number(id)));
        (user.watchlist || []).forEach(id => interactedMovieIds.add(Number(id)));
        (user.watchHistory || []).forEach(item => {
            const id = typeof item === "number" ? item : item?.movieId;
            if (id) interactedMovieIds.add(Number(id));
        });

        const movieMap = new Map();

        // 1. Primary path: Up to 10 most recent favorites
        const recentFavorites = (user.favorites || []).slice(-10);

        if (recentFavorites.length > 0) {
            const fetchPromises = recentFavorites.map(favId =>
                tmdbClient.get(`/movie/${favId}/recommendations`).then(res => res.data.results || []).catch(err => {
                    console.error(`Error fetching recommendations for favorite ${favId}:`, err.message);
                    return [];
                })
            );

            const resultsArrays = await Promise.all(fetchPromises);

            resultsArrays.forEach(resultsArray => {
                resultsArray.forEach((movie, index) => {
                    if (movie && movie.id && !interactedMovieIds.has(movie.id)) {
                        const positionScore = 1 / (index + 1);
                        const pop = movie.popularity || 1;
                        const score = positionScore * pop;

                        if (movieMap.has(movie.id)) {
                            movieMap.get(movie.id).score += score;
                        } else {
                            movieMap.set(movie.id, { movie, score });
                        }
                    }
                });
            });
        }

        // 2. Fallback / Top-up path if movieMap has fewer than 20 items
        if (movieMap.size < 20) {
            const genreIds = (user.favoriteGenres || [])
                .map(genre => genreMap[genre])
                .filter(Boolean);

            const actorIds = (user.favoriteActors || [])
                .map(actor => (typeof actor === "number" ? actor : actor?.id))
                .filter(Boolean);

            if (genreIds.length > 0 || actorIds.length > 0) {
                const fallbackPromises = [];

                if (genreIds.length > 0) {
                    fallbackPromises.push(
                        tmdbClient.get("/discover/movie", {
                            params: {
                                with_genres: genreIds.join("|"),
                                sort_by: "popularity.desc"
                            }
                        }).then(res => res.data.results || []).catch(() => [])
                    );
                }

                if (actorIds.length > 0) {
                    fallbackPromises.push(
                        tmdbClient.get("/discover/movie", {
                            params: {
                                with_people: actorIds.join("|"),
                                sort_by: "popularity.desc"
                            }
                        }).then(res => res.data.results || []).catch(() => [])
                    );
                }

                const fallbackArrays = await Promise.all(fallbackPromises);

                fallbackArrays.forEach(fallbackArray => {
                    fallbackArray.forEach((movie, index) => {
                        if (movie && movie.id && !interactedMovieIds.has(movie.id)) {
                            const positionScore = 1 / (index + 1);
                            const pop = movie.popularity || 1;
                            const score = positionScore * pop;

                            if (movieMap.has(movie.id)) {
                                movieMap.get(movie.id).score += score;
                            } else {
                                movieMap.set(movie.id, { movie, score });
                            }
                        }
                    });
                });
            }
        }

        // Cold-start check: If no recommendations collected at all, return empty array
        if (movieMap.size === 0) {
            return res.status(200).json([]);
        }

        // Sort pool by relevance score descending and slice top 20
        const sortedMovies = Array.from(movieMap.values())
            .sort((a, b) => b.score - a.score)
            .map(item => item.movie)
            .slice(0, 20);

        return res.status(200).json(sortedMovies);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};