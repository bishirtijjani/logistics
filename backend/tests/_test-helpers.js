/**
 * Test helpers — inject in-memory stubs for the prisma and redis singletons
 * BEFORE the modules-under-test get required. Avoids needing a live DB/Redis
 * for unit tests of middleware and services.
 *
 * Usage:
 *   const { installStubs } = require('./_test-helpers');
 *   const stubs = installStubs(); // must be called before require()-ing app code
 *   const { idempotency } = require('../src/middlewares/idempotency.middleware');
 */

const path = require('node:path');
const Module = require('node:module');

const DB_PATH = path.resolve(__dirname, '../src/config/database.js');
const REDIS_PATH = path.resolve(__dirname, '../src/config/redis.js');
const CONFIG_PATH = path.resolve(__dirname, '../src/config/index.js');

const makePrismaStub = () => {
  const idempotencyKey = {
    _store: new Map(),
    async findUnique({ where }) {
      return idempotencyKey._store.get(where.key) || null;
    },
    async create({ data }) {
      if (idempotencyKey._store.has(data.key)) {
        const err = new Error(`Unique constraint failed on the fields: (\`key\`)`);
        err.code = 'P2002';
        throw err;
      }
      idempotencyKey._store.set(data.key, { ...data });
      return idempotencyKey._store.get(data.key);
    },
    async update({ where, data }) {
      const existing = idempotencyKey._store.get(where.key);
      if (!existing) throw new Error('not found');
      const merged = { ...existing, ...data };
      idempotencyKey._store.set(where.key, merged);
      return merged;
    },
    async delete({ where }) {
      idempotencyKey._store.delete(where.key);
      return null;
    },
  };

  const platformSetting = {
    _store: new Map(),
    seed(map) {
      for (const [key, value] of Object.entries(map)) {
        platformSetting._store.set(key, { key, value });
      }
    },
    async findMany() {
      return Array.from(platformSetting._store.values());
    },
    async upsert({ where, update, create }) {
      const existing = platformSetting._store.get(where.key);
      if (existing) {
        const merged = { ...existing, ...update };
        platformSetting._store.set(where.key, merged);
        return merged;
      }
      platformSetting._store.set(create.key, create);
      return create;
    },
  };

  return { idempotencyKey, platformSetting };
};

const makeRedisStub = () => {
  const store = new Map();
  return {
    _store: store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value /* , ...rest */) {
      store.set(key, value);
      return 'OK';
    },
    async del(key) {
      const had = store.has(key);
      store.delete(key);
      return had ? 1 : 0;
    },
    async publish() {
      return 0;
    },
  };
};

const stubModule = (filename, exports) => {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
};

const installStubs = ({ prisma, redis, config } = {}) => {
  const prismaStub = prisma || makePrismaStub();
  const redisStub = redis || makeRedisStub();
  const configStub = config || {
    NODE_ENV: 'test',
    DELIVERY_BASE_FARE: 200,
    DELIVERY_PER_KM_RATE: 100,
    DELIVERY_PLATFORM_FEE_PERCENT: 10,
  };

  stubModule(DB_PATH, { prisma: prismaStub });
  stubModule(REDIS_PATH, { redis: redisStub });
  stubModule(CONFIG_PATH, { config: configStub });

  // Also stub the logger to keep test output clean.
  const loggerPath = path.resolve(__dirname, '../src/utils/logger.js');
  stubModule(loggerPath, {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  });

  return { prisma: prismaStub, redis: redisStub, config: configStub };
};

const clearStubs = () => {
  delete require.cache[DB_PATH];
  delete require.cache[REDIS_PATH];
  delete require.cache[CONFIG_PATH];
};

const makeRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    async json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

module.exports = { installStubs, clearStubs, makePrismaStub, makeRedisStub, makeRes };
