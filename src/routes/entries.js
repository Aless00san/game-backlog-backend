import Entry from "../models/Entry.js";
import User from "../models/User.js";
import Game from "../models/Game.js";

async function entryRoutes(fastify, options) {
  fastify.post(
    "/entries",
    {
      schema: {
        description: "Create a new entry",
        tags: ["Entries"],
        body: {
          type: "object",
          required: [
            "review",
            "reviewer",
            "date",
            "gameid",
            "playedOnPlatform",
          ],
          properties: {
            review: { type: "string" },
            reviewer: { type: "string" }, // user _id
            date: { type: "string" }, // DD/MM/YYYY or ISO
            gameid: { type: "string" },
            playedOnPlatform: { type: "number" },
          },
        },
        response: {
          201: {
            type: "object",
            description: "Entry created successfully",
            properties: {
              _id: { type: "string" },
              review: { type: "string" },
              reviewer: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                },
              },
              game: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  rawgId: { type: "string" },
                  title: { type: "string" },
                  imageUrl: { type: "string" },
                  platform: { type: "string" },
                },
              },
              playedOnPlatform: { type: "number" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { reviewer, review, date, gameid, playedOnPlatform } = req.body;

        // Validate reviewer
        const user = await User.findById(reviewer);
        if (!user) return reply.code(404).send({ error: "Reviewer not found" });

        // Find game by RAWG ID
        const game = await Game.findOne({ rawgId: gameid });
        if (!game) return reply.code(404).send({ error: "Game not found" });

        // Parse date (support DD/MM/YYYY or ISO)
        let parsedDate;
        if (date.includes("/")) {
          const [day, month, year] = date.split("/");
          parsedDate = new Date(`${year}-${month}-${day}`);
        } else {
          parsedDate = new Date(date);
        }

        const existingEntry = await Entry.findOne({
          reviewer: reviewer,
          gameid: game._id,
          playedOnPlatform: playedOnPlatform,
        });

        if (existingEntry) {
          return reply
            .code(400)
            .send({ error: "You already reviewed this game on this platform" });
        }

        // Create entry
        const entry = new Entry({
          reviewer,
          gameid: game._id, // store Mongo _id for populate
          review,
          date: parsedDate,
          playedOnPlatform,
        });

        try {
          await entry.save();
        } catch (err) {
          if (err.code === 11000) {
            return reply.code(400).send({
              error: "You already reviewed this game on this platform",
            });
          }
        }

        // Populate reviewer and game
        await entry.populate([
          { path: "reviewer", select: "_id name email" },
          { path: "gameid" }, // populate full game document
        ]);

        // Prepare response
        const entryObj = entry.toObject();
        entryObj.game = entryObj.gameid; // rename for clarity
        delete entryObj.gameid;

        reply.code(201).send(entryObj);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );

  fastify.get(
    "/entries",
    {
      schema: {
        description: "Retrieve all entries",
        tags: ["Entries"],
        response: {
          200: {
            description: "Success",
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                review: { type: "string" },
                reviewer: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                },
                game: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    rawgId: { type: "string" },
                    title: { type: "string" },
                    imageUrl: { type: "string" },
                    platform: { type: "string" },
                  },
                },
                playedOnPlatform: { type: "number" },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const entries = await Entry.find()
        .populate({ path: "reviewer", select: "_id name email" })
        .populate({ path: "gameid" });

      // rename gameid to game, so the response knows what to show
      const result = entries.map((e) => {
        const obj = e.toObject();
        obj.game = obj.gameid;
        delete obj.gameid;
        return obj;
      });

      reply.code(200).send(result);
    }
  );

  //get all entries where the name contains the search term
  fastify.get(
    "/entries/search",
    {
      schema: {
        description: "Search entries",
        tags: ["Entries"],
        querystring: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Search term",
            },
          },
        },
        response: {
          200: {
            description: "Success",
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                review: { type: "string" },
                reviewer: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                },
                game: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    rawgId: { type: "string" },
                    title: { type: "string" },
                    imageUrl: { type: "string" },
                    platform: { type: "string" },
                  },
                },
                playedOnPlatform: { type: "number" },
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
        const search = req.query.search || "";
        const regex = new RegExp(search, "i"); // case-insensitive

        const entries = await Entry.find()
          .populate("reviewer")
          .populate("gameid");

        const result = entries
          .filter((entry) => entry.gameid.title.match(regex))
          .map((e) => {
            const obj = e.toObject();
            obj.game = obj.gameid;
            delete obj.gameid;
            return obj;
          });

        return reply.code(200).send(result);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );
}

export default entryRoutes;
