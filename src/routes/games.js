import Game from '../models/Game.js';
import { distance } from 'fastest-levenshtein';

function normalizeTitle(str) {
  return str
    .toLowerCase()
    .replace(/g\.u\./g, 'gu')
    .replace(/\/+/g, ' ')
    .replace(/\.+/g, ' ')
    .replace(/ver\s*\d+[\d\.]*/g, '')
    .replace(/\b(part|episode)\s*\d+\b/g, '')
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
    '/games/search',
    {
      schema: {
        description: 'Hybrid search for games (local DB + RAWG fallback)',
        tags: ['Games'],
        querystring: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                rawgId: { type: 'string' },
                title: { type: 'string' },
                imageUrl: { type: 'string' },
                platform: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const search = req.query.name;
        const regex = new RegExp(search, 'i');

        let localGames = await Game.find({ title: regex });

        if (localGames.length < 6) {
          const remaining = 6 - localGames.length;

          const rawgRes = await fetch(
            `https://api.rawg.io/api/games?key=${
              process.env.RAWG_API_KEY
            }&search=${encodeURIComponent(search)}&page_size=${remaining}`
          );
          const rawgData = await rawgRes.json();
          const now = new Date().toISOString();

          const rawgGames = rawgData.results.map(game => ({
            _id: game.id.toString(),
            rawgId: game.id.toString(),
            title: game.name,
            imageUrl: game.background_image,
            platform:
              game.platforms?.map(p => p.platform.name).join(', ') || '',
            createdAt: null,
            updatedAt: now,
          }));

          await Promise.all(
            rawgGames.map(async game => {
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

          const existingIds = new Set(localGames.map(g => g.rawgId));
          localGames = [
            ...localGames,
            ...rawgGames.filter(g => !existingIds.has(g.rawgId)),
          ];
        }

        reply.code(200).send(localGames);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );

  fastify.post(
    '/games',
    {
      schema: {
        description: 'Add a new game',
        tags: ['Games'],
        body: {
          type: 'object',
          required: ['title', 'imageUrl', 'platform'],
          properties: {
            title: { type: 'string' },
            rawgId: { type: 'string' },
            imageUrl: { type: 'string' },
            platforms: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Succes',
            properties: {
              _id: { type: 'string' },
              title: { type: 'string' },
              rawgId: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            description: 'Error',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { title, rawgId, imageUrl, platform } = req.body;

        const game = new Game({ title, rawgId, imageUrl, platform });
        await game.save();

        reply.code(201).send(game);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );
}

export default gameRoutes;
