import Game from "../models/Game.js";
import Platform from "../models/Platform.js";
import { distance } from "fastest-levenshtein";

const MAX_FETCHED_GAMES = 6;

function normalizeTitle(str) {
  return str
    .toLowerCase()
    .replace(/g\.u\./g, "gu")
    .replace(/\/+/g, " ")
    .replace(/\.+/g, " ")
    .replace(/ver\s*\d+[\d\.]*/g, "")
    .replace(/\b(part|episode)\s*\d+\b/g, "")
    .trim();
}

function levenshteinSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - distance(na, nb) / maxLen;
}

async function gameRoutes(fastify, options) {
  fastify.get(
    "/games/search",
    {
      schema: {
        description: "Hybrid search for games (local DB + RAWG fallback)",
        tags: ["Games"],
        querystring: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                rawgId: { type: "string" },
                title: { type: "string" },
                imageUrl: { type: "string" },
                platformNames: { type: "array", items: { type: "string" } },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const platformDocs = await Platform.find().lean();
        const platformMap = new Map(platformDocs.map((p) => [p._id, p.name]));

        const search = req.query.name;
        const regex = new RegExp(search, "i");

        let localGames = await Game.find({ title: regex }).lean();

        //Map platforms to names
        localGames.forEach((g) => {
          g.platformNames = g.platforms
            .map((p) => platformMap.get(p))
            .filter(Boolean);
        });

        if (localGames.length < MAX_FETCHED_GAMES) {
          const remaining = MAX_FETCHED_GAMES - localGames.length;

          const rawgRes = await fetch(
            `https://api.rawg.io/api/games?key=${
              process.env.RAWG_API_KEY
            }&search=${encodeURIComponent(search)}&page_size=${remaining * 2}`
          );
          const rawgData = await rawgRes.json();
          const now = new Date().toISOString();

          const rawgGames = rawgData.results.map((game) => ({
            _id: game.id.toString(),
            rawgId: game.id.toString(),
            title: game.name,
            imageUrl: game.background_image,
            platformNames: game.platforms?.map((p) => p.platform.name) || [],
            createdAt: null,
            updatedAt: now,
          }));

          await Promise.all(
            rawgGames.map(async (game) => {
              const steamSearch = normalizeTitle(game.title);
              const steamRes = await fetch(
                `https://www.steamgriddb.com/api/v2/search/autocomplete/${steamSearch}`,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.STEAMGRID_API_KEY}`,
                  },
                }
              );
              const steamData = await steamRes.json();

              for (const steamGame of steamData.data) {
                if (
                  levenshteinSimilarity(steamGame.name, game.title) > 0.55 &&
                  steamGame.id
                ) {
                  try {
                    const steamGridRes = await fetch(
                      `https://www.steamgriddb.com/api/v2/grids/game/${steamGame.id}`,
                      {
                        headers: {
                          Authorization: `Bearer ${process.env.STEAMGRID_API_KEY}`,
                        },
                      }
                    );
                    const steamGridData = await steamGridRes.json();
                    game.imageUrl = steamGridData.data[0].url;
                    break;
                  } catch (err) {
                    continue;
                  }
                }
              }
            })
          );

          const existingIds = new Set(localGames.map((g) => g.rawgId));
          const mergedGames = [
            ...localGames,
            ...rawgGames.filter((g) => !existingIds.has(g.rawgId)),
          ];

          localGames = mergedGames.slice(0, 6);
        }

        reply.code(200).send(localGames);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );

  fastify.post(
    "/games",
    {
      schema: {
        description: "Add a new game",
        tags: ["Games"],
        body: {
          type: "object",
          required: ["title", "imageUrl", "platforms"],
          properties: {
            title: { type: "string" },
            rawgId: { type: "string" },
            imageUrl: { type: "string" },
            platforms: { type: "array", items: { type: "number" } },
          },
        },
        response: {
          201: {
            type: "object",
            description: "Succes",
            properties: {
              _id: { type: "string" },
              title: { type: "string" },
              rawgId: { type: "string" },
            },
          },
          400: {
            type: "object",
            description: "Error",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { title, rawgId, imageUrl, platforms } = req.body;

        const game = new Game({ title, rawgId, imageUrl, platforms });

        await game.save();

        reply.code(201).send(game);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );
}

export default gameRoutes;
