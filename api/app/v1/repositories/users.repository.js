'use strict';

export const UsersRepository = ({ db, collections, logger }) => {
  const name = collections.users;

  logger.info(`Start Collection - ${name}`);

  const collection = db.collection(name);

  return {
    findOne: query => collection.findOne(query),
    find: (query, options) => collection.find(query, options).toArray(),
    insertOne: document => collection.insertOne(document),
    updateOne: (query, data) => collection.updateOne(query, { $set: data }),
  };
};
