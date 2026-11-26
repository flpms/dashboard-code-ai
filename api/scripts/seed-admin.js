#!/usr/bin/env node
'use strict';

/**
 * Creates a tenant's first super-admin.
 *
 * This is the only supported way to bootstrap an account. Refuses to run
 * against a non-empty users collection unless `--force` is passed, so it cannot
 * be used later to quietly mint a second super-admin.
 *
 * Usage:
 *   node scripts/seed-admin.js --email=a@b.com --name="Admin" --tenantId=<ObjectId> [--force]
 */

import { randomBytes } from 'node:crypto';

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

import { hashPassword } from '../app/lib/password.js';

const parseArgs = argv =>
  argv.reduce(
    (args, arg) => {
      if (arg === '--force') return { ...args, force: true };
      const match = arg.match(/^--([^=]+)=(.*)$/);
      return match ? { ...args, [match[1]]: match[2] } : args;
    },
    { force: false }
  );

const args = parseArgs(process.argv.slice(2));

const required = ['email', 'name', 'tenantId'].filter(key => !args[key]);

if (required.length) {
  console.error(`Missing arguments: ${required.map(key => `--${key}`).join(', ')}`);
  process.exit(1);
}

// Read the collection name from the environment, never a literal: the *value*
// of USERS_COLLECTION differs between environments, and a hardcoded string here
// would silently seed the wrong collection.
const { MONGO_CONNECTION, USERS_COLLECTION } = process.env;

if (!MONGO_CONNECTION || !USERS_COLLECTION) {
  console.error('Missing MONGO_CONNECTION or USERS_COLLECTION in the environment.');
  process.exit(1);
}

const client = new MongoClient(MONGO_CONNECTION);

try {
  await client.connect();
  const users = client.db().collection(USERS_COLLECTION);

  const existing = await users.countDocuments({});

  if (existing > 0 && !args.force) {
    console.error(`Refusing to seed: ${existing} user(s) already exist. Pass --force to override.`);
    process.exit(1);
  }

  // A generated password, printed once and never stored in plaintext. The hash
  // comes from lib/password.js, the same module sign-in checks against.
  const password = randomBytes(18).toString('base64url');

  await users.insertOne({
    email: args.email,
    name: args.name,
    role: 'super-admin',
    tenantId: new ObjectId(args.tenantId),
    passwordHash: hashPassword(password),
    deleted: false,
    createdAt: new Date(),
  });

  console.log(`Created super-admin ${args.email}`);
  console.log(`Temporary password (shown once): ${password}`);
} finally {
  await client.close();
}
