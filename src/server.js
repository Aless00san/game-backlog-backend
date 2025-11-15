import Fastify from "fastify";
import dotenv from "dotenv";
import dbPlugin from "./plugins/db.js";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

import userRoutes from './routes/users.js'
import entryRoutes from "./routes/entries.js";
import gameRoutes from "./routes/games.js";

dotenv.config();

const fastify = Fastify({ logger: true });

// CORS
await fastify.register(cors, { origin: true });

// Swagger/OpenAPI
await fastify.register(swagger, {
  openapi: {
    info: {
      title: "Backlog API",
      version: "1.0.0",
      description: "API for managing games backlog",
    },
  },
});
await fastify.register(swaggerUI, { routePrefix: "/docs", staticCSP: true });

// MongoDB connection
await fastify.register(dbPlugin);

await fastify.register(userRoutes, { prefix: '/api' })
await fastify.register(entryRoutes, { prefix: '/api' })
await fastify.register(gameRoutes, { prefix: '/api' })

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000 });
    fastify.log.info(
      `🚀 Server running at http://127.0.0.1:${process.env.PORT || 3000}`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
