import Game from '../models/Game.js';

function toCamelCase(string) {
  const lower = string.toLowerCase();
  const words = lower.split(' ');
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function gameRoutes(fastify, options) {
  // Hybrid search for backlog
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

        // games in local DB
        let localGames = await Game.find({ title: regex });

        if (localGames.length < 6) {
          const remaining = 6 - localGames.length;

          // fetch from RAWG
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
            title: toCamelCase(game.name),
            imageUrl: game.background_image,
            platform:
              game.platforms?.map(p => p.platform.name).join(', ') || '',
            createdAt: null,
            updatedAt: now,
          }));

          for (const game of rawgGames) {
            // fetch the game in steamgrid
            // https://www.steamgriddb.com/api/v2/search/autocomplete/{term}
            // Requieres API key via bearer token
            const steamRes = await fetch(
              `https://www.steamgriddb.com/api/v2/search/autocomplete/${game.title}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.STEAMGRID_API_KEY}`,
                },
              }
            );
            const steamData = await steamRes.json();

            for (const steamGame of steamData.data) {
              if (steamGame.name === game.title && steamGame.id) {
                // fetch grid
                const steamGridRes = await fetch(
                  `https://www.steamgriddb.com/api/v2/grids/game/${steamGame.id}`,
                  {
                    headers: {
                      Authorization: `Bearer ${process.env.STEAMGRID_API_KEY}`,
                    },
                  }
                );
                try {
                  const steamGridData = await steamGridRes.json();
                  game.imageUrl = steamGridData.data[0].url;
                } catch (err) {
                  continue;
                }
              }
            }
          }

          // Merge local and RAWG results, avoiding duplicatesd
          const existingIds = new Set(localGames.map(g => g.rawgId));
          localGames = [
            ...localGames,
            ...rawgGames.filter(g => !existingIds.has(g.rawgId)),
          ];
        }

        // Return combined results
        reply.code(200).send(localGames);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );

  // add a new game
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
