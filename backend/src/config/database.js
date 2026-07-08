const mongoose = require('mongoose');
const logger   = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    maxPoolSize:        10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS:    45000,
    family:             4,
  });

  logger.info(`MongoDB connected: ${mongoose.connection.host}`);

  mongoose.connection.on('error',        err => logger.error(`MongoDB error: ${err.message}`));
  mongoose.connection.on('disconnected', ()  => logger.warn('MongoDB disconnected — retrying…'));
};

module.exports = connectDB;
