'use strict';

const maskCredentials = url => String(url).replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

export const DBStartup = async ({ env, logger, MongoClient }) => {
  const { databaseURL } = env.db;

  logger.verbose(`Connecting to database: ${maskCredentials(databaseURL)}`);

  const client = new MongoClient(databaseURL, {
    // A request that waits forever on a dead primary looks like a hung app.
    // Failing in 10s turns it into a 503 the health check can see.
    serverSelectionTimeoutMS: 10_000,
  });

  await client.connect();

  const db = client.db();

  await db.command({ ping: 1 });
  logger.info('Database connection established');

  return { db, dbClient: client };
};
