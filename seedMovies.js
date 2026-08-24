/**
 * seedMovies.js — populate the Movie collection from TMDB
 *
 * Run once:  node seedMovies.js
 * Re-run safely: existing documents are skipped (upsert on tmdbId)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import Movie from "./Schema/movieSchema.js";   // ← model, not User

dotenv.config();

// ── 1. Connect ────────────────────────────────────────────────────────────────
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
await mongoose.connect(mongoUri);
console.log("MongoDB connected");

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const PAGES = 5;   // 5 pages × 20 results × 3 endpoints = up to 300 movies

// ── 2. Fetch helpers ──────────────────────────────────────────────────────────

/**
 * Fetch one page from a TMDB list endpoint.
 * Returns the results array, or [] on failure so the loop keeps going.
 */
async function fetchPage(endpoint, page) {
    try {
        const { data } = await axios.get(`${TMDB_BASE}${endpoint}`, {
            params: { api_key: TMDB_API_KEY, page },
        });
        return data.results ?? [];
    } catch (err) {
        console.warn(`  ✗ ${endpoint} page ${page}: ${err.message}`);
        return [];
    }
}

/**
 * Fetch `pages` pages from an endpoint and return all results combined.
 */
async function fetchAll(endpoint) {
    const results = [];
    for (let page = 1; page <= PAGES; page++) {
        const batch = await fetchPage(endpoint, page);
        results.push(...batch);
        process.stdout.write(`\r  ${endpoint}  page ${page}/${PAGES} — ${results.length} fetched`);
    }
    console.log();   // newline after progress line
    return results;
}

// ── 3. Fetch from three endpoints ─────────────────────────────────────────────
console.log("\nFetching from TMDB…");

const [popular, topRated, nowPlaying] = await Promise.all([
    fetchAll("/movie/popular"),
    fetchAll("/movie/top_rated"),
    fetchAll("/movie/now_playing"),
]);

// ── 4. Deduplicate by TMDB id ─────────────────────────────────────────────────
const seen = new Set();
const allRaw = [...popular, ...topRated, ...nowPlaying];
const unique = allRaw.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
});
console.log(`\n${unique.length} unique movies after deduplication`);

// ── 5. Map TMDB shape → Movie schema shape ────────────────────────────────────
//
// genre_ids is an array of numeric TMDB IDs.
// The recommendation controller's genreMap works with genre names,
// so we store both the numeric ids AND the resolved names.
//
const GENRE_MAP = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
};

const docs = unique.map(m => ({
    tmdbId: String(m.id),
    title: m.title ?? m.original_title ?? "Untitled",
    genres: (m.genre_ids ?? []).map(id => GENRE_MAP[id]).filter(Boolean),
    actors: [],        // TMDB list endpoints don't include cast; populated on demand
    rating: m.vote_average ?? 0,
    popularity: m.popularity ?? 0,
}));

// ── 6. Upsert into MongoDB ────────────────────────────────────────────────────
//      ordered: false → continue inserting even if some duplicates slip through
const ops = docs.map(doc => ({
    updateOne: {
        filter: { tmdbId: doc.tmdbId },
        update: { $setOnInsert: doc },
        upsert: true,
    },
}));

const result = await Movie.bulkWrite(ops, { ordered: false });

console.log(`\nDone.`);
console.log(`  Inserted : ${result.upsertedCount}`);
console.log(`  Skipped  : ${result.matchedCount} (already existed)`);

await mongoose.disconnect();
console.log("MongoDB disconnected");