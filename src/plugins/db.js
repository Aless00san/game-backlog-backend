import fp from 'fastify-plugin';
import mongoose from 'mongoose';

// Fastify plugin for MongoDB connection
async function dbConnector(fastify, options) {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gamebacklog';
  try {
    await mongoose.connect(uri);
    fastify.log.info('MongoDB connection established');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Export the plugin
export default fp(dbConnector);
