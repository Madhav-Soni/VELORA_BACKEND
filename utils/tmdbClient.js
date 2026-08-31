import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const tmdbClient = axios.create({
    baseURL: "https://api.themoviedb.org/3",
    params: {
        api_key: process.env.TMDB_API_KEY
    }
});

export default tmdbClient;
