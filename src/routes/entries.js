import Entry from '../models/Entry.js';
import User from '../models/User.js';
import Game from '../models/Game.js';

async function entryRoutes(fastify, options) {
  // CREATE ENTRY
  fastify.post(
    '/entries',
    {
      schema: {
        description: 'Create a new entry',
        tags: ['Entries'],
        body: {
          type: 'object',
          required: ['user', 'gameid', 'playedOnPlatform'],
          properties: {
            user: { type: 'string' },
            gameid: { type: 'string' }, // RAWG ID or Mongo ID?
            playedOnPlatform: { type: 'number' },
            status: {
              type: 'string',
              enum: ['Backlog', 'Playing', 'Completed'],
              default: 'Backlog',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
              game: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  rawgId: { type: 'string' },
                  title: { type: 'string' },
                  imageUrl: { type: 'string' },
                },
              },
              playedOnPlatform: { type: 'number' },
              status: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { user, gameid, playedOnPlatform, status } = req.body;

        // Validate user
        const existingUser = await User.findById(user);
        if (!existingUser)
          return reply.code(404).send({ error: 'User not found' });

        // Find game by rawgId OR by _id
        const game =
          (await Game.findOne({ rawgId: gameid })) ||
          (await Game.findById(gameid));

        if (!game) return reply.code(404).send({ error: 'Game not found' });

        // Check duplicate
        const existingEntry = await Entry.findOne({
          user,
          gameid: game._id,
          playedOnPlatform,
        });

        if (existingEntry)
          return reply
            .code(400)
            .send({ error: 'Entry already exists for this platform' });

        // Create entry
        const entry = new Entry({
          user,
          gameid: game._id,
          playedOnPlatform,
          status,
        });

        await entry.save();

        await entry.populate([
          { path: 'user', select: '_id name' },
          { path: 'gameid' },
        ]);

        // Rename gameid → game
        const obj = entry.toObject();
        obj.game = obj.gameid;
        delete obj.gameid;

        reply.code(201).send(obj);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );

  // GET ALL ENTRIES
  fastify.get(
    '/entries',
    {
      schema: {
        description: 'Retrieve all entries',
        tags: ['Entries'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
                game: {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    rawgId: { type: 'string' },
                    title: { type: 'string' },
                    imageUrl: { type: 'string' },
                  },
                },
                playedOnPlatform: { type: 'number' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const entries = await Entry.find()
        .populate({ path: 'user', select: '_id name' })
        .populate({ path: 'gameid' });

      const result = entries.map(e => {
        const obj = e.toObject();
        obj.game = obj.gameid;
        delete obj.gameid;
        return obj;
      });

      reply.code(200).send(result);
    }
  );

  // SEARCH ENTRIES BY GAME NAME
  fastify.get(
    '/entries/search',
    {
      schema: {
        description: 'Search entries',
        tags: ['Entries'],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const search = req.query.search || '';
        const regex = new RegExp(search, 'i');

        const entries = await Entry.find().populate('user').populate('gameid');

        const result = entries
          .filter(e => e.gameid.title.match(regex))
          .map(e => {
            const obj = e.toObject();
            obj.game = obj.gameid;
            delete obj.gameid;
            return obj;
          });

        reply.code(200).send(result);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );
}

export default entryRoutes;
