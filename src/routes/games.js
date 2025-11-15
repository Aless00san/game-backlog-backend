import Game from "../models/Game.js";

async function gameRoutes(fastify, options) {
  // retrieve a game by name
  fastify.get(
    "/games/:name",
    {
      schema: {
        description: "Retrieve a game by name",
        tags: ["Games"],
        params: {
          type: "object",
          properties: {
            name: {
              type: "string",
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            description: "Succes",
            properties: {
              _id: { type: "string" },
              rawgId: { type: "string" },
              steamgriddbId: { type: "string" },
              title: { type: "string" },
              imageUrl: { type: "string" },
              platform: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
          404: {
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
      let game = await Game.findOne({ title: req.params.name });

      if (!game) {
        return reply.code(404).send({ error: "Game not found" });
      }

      reply.code(200).send(game);
    }
  );

  // add a new game
  fastify.post(
    "/games",
    {
      schema: {
        description: "Add a new game",
        tags: ["Games"],
        body: {
          type: "object",
          required: ["title", "imageUrl", "platform"],
          properties: {
            title: { type: "string" },
            rawgId: { type: "string" },
            imageUrl: { type: "string" },
            platforms: { type: "array", items: { type: "string" } },
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
