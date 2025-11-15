import User from "../models/User.js";

async function userRoutes(fastify, options) {
  fastify.post(
    "/users",
    {
      schema: {
        description: "Create a new user",
        body: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        tags: ["Users"],
        response: {
          201: {
            type: "object",
            description: "Succes",
            properties: {
              _id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const user = new User(req.body);
        await user.save();
        const { password, ...userWithoutPassword } = user.toObject();
        reply.code(201).send(userWithoutPassword);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );

  fastify.get(
    "/users",
    {
      schema: {
        description: "Retrieve all users",
        tags: ["Users"],
        response: {
          200: {
            description: "Success",
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
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
        const users = await User.find();
        reply.code(200).send(users);
      } catch (err) {
        reply.code(400).send({ error: err.message });
      }
    }
  );
}

export default userRoutes;
