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
  const ttls = new Map();
  return {
    _store: store,
    _ttls: ttls,
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
      ttls.delete(key);
      return had ? 1 : 0;
    },
    async exists(key) {
      return store.has(key) ? 1 : 0;
    },
    async expire(key, seconds) {
      ttls.set(key, seconds);
      return store.has(key) ? 1 : 0;
    },
    async ttl(key) {
      // Always-fresh stub: keys with a recorded ttl return that, otherwise 0
      // (meaning "no ttl / not set"). Negative-1 is "no expiry"; tests usually
      // only care about >0 vs 0 to gate cooldown logic.
      return ttls.has(key) ? ttls.get(key) : 0;
    },
    async incr(key) {
      const current = Number(store.get(key) || 0) + 1;
      store.set(key, current);
      return current;
    },
    async publish() {
      return 0;
    },
  };
};

/**
 * In-memory stand-ins for the Prisma models the auth, address, notification,
 * and request services touch. Kept minimal — only the methods + columns each
 * service actually reads/writes are implemented, and a few helpers (seed,
 * _rows, _byId) for tests to set up state.
 */
const makeAuthPrismaStub = () => {
  let uid = 0;
  const newId = () => `00000000-0000-4000-a000-${String(++uid).padStart(12, '0')}`;

  const user = {
    _rows: new Map(),
    seed(rows) {
      for (const r of rows) {
        const id = r.id || newId();
        user._rows.set(id, { id, ...r });
      }
      return Array.from(user._rows.values());
    },
    async findUnique({ where, include, select }) {
      let row = null;
      if (where.id) row = user._rows.get(where.id);
      else if (where.email) row = [...user._rows.values()].find((u) => u.email === where.email);
      else if (where.phone) row = [...user._rows.values()].find((u) => u.phone === where.phone);
      if (!row) return null;
      if (select) {
        const out = {};
        for (const k of Object.keys(select)) if (select[k]) out[k] = row[k];
        return out;
      }
      if (include?.merchant) row = { ...row, merchant: row.merchant || null };
      if (include?.wallet) row = { ...row, wallet: row.wallet || null };
      return row;
    },
    async create({ data }) {
      const id = data.id || newId();
      const row = { id, ...data };
      // Inline relations (`wallet: { create: { ... } }`) — flatten so tests
      // can find e.g. user.wallet without a separate join.
      if (data.wallet?.create) row.wallet = { id: newId(), ...data.wallet.create, userId: id };
      if (data.merchant?.create) row.merchant = { id: newId(), ...data.merchant.create, userId: id };
      user._rows.set(id, row);
      return row;
    },
    async update({ where, data, select }) {
      const row = user._rows.get(where.id) || [...user._rows.values()].find((u) => u.email === where.email);
      if (!row) throw new Error('user not found');
      Object.assign(row, data);
      if (select) {
        const out = {};
        for (const k of Object.keys(select)) if (select[k]) out[k] = row[k];
        return out;
      }
      return row;
    },
  };

  const session = {
    _rows: new Map(),
    async findUnique({ where, include }) {
      let row = null;
      if (where.id) row = session._rows.get(where.id);
      else if (where.refreshToken) row = [...session._rows.values()].find((s) => s.refreshToken === where.refreshToken);
      if (!row) return null;
      if (include?.user) row = { ...row, user: user._rows.get(row.userId) };
      return row;
    },
    async create({ data }) {
      const id = data.id || newId();
      const row = {
        id,
        isRevoked: false,
        createdAt: new Date(),
        lastUsedAt: data.lastUsedAt || new Date(),
        ...data,
      };
      session._rows.set(id, row);
      return row;
    },
    async update({ where, data }) {
      const row = session._rows.get(where.id);
      if (!row) throw new Error('session not found');
      Object.assign(row, data);
      return row;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of session._rows.values()) {
        if (where.userId && row.userId !== where.userId) continue;
        if (where.isRevoked !== undefined && row.isRevoked !== where.isRevoked) continue;
        if (where.refreshToken?.not && row.refreshToken === where.refreshToken.not) continue;
        if (typeof where.refreshToken === 'string' && row.refreshToken !== where.refreshToken) continue;
        Object.assign(row, data);
        count++;
      }
      return { count };
    },
    async findMany({ where, orderBy, select }) {
      let rows = [...session._rows.values()];
      if (where) {
        if (where.userId) rows = rows.filter((r) => r.userId === where.userId);
        if (where.isRevoked !== undefined) rows = rows.filter((r) => r.isRevoked === where.isRevoked);
        if (where.expiresAt?.gt) rows = rows.filter((r) => r.expiresAt > where.expiresAt.gt);
      }
      if (orderBy?.lastUsedAt) {
        rows.sort((a, b) =>
          orderBy.lastUsedAt === 'desc' ? b.lastUsedAt - a.lastUsedAt : a.lastUsedAt - b.lastUsedAt,
        );
      }
      if (select) return rows.map((r) => Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, r[k]])));
      return rows;
    },
  };

  const wallet = {
    _rows: new Map(),
    async findUnique({ where, select }) {
      const row = [...wallet._rows.values()].find((w) => w.userId === where.userId);
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
    async create({ data }) {
      const id = data.id || newId();
      const row = { id, balance: 0, ...data };
      wallet._rows.set(id, row);
      return row;
    },
    async update({ where, data }) {
      const row = [...wallet._rows.values()].find((w) => w.userId === where.userId);
      if (!row) throw new Error('wallet not found');
      Object.assign(row, data);
      return row;
    },
  };

  const notificationPreferences = {
    _rows: new Map(),
    async findUnique({ where }) {
      return [...notificationPreferences._rows.values()].find((p) => p.userId === where.userId) || null;
    },
    async create({ data }) {
      const row = { id: newId(), ...data };
      notificationPreferences._rows.set(row.id, row);
      return row;
    },
    async upsert({ where, create, update }) {
      const existing = [...notificationPreferences._rows.values()].find((p) => p.userId === where.userId);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { id: newId(), ...create };
      notificationPreferences._rows.set(row.id, row);
      return row;
    },
  };

  const savedAddress = {
    _rows: new Map(),
    async findMany({ where, orderBy }) {
      let rows = [...savedAddress._rows.values()];
      if (where?.userId) rows = rows.filter((a) => a.userId === where.userId);
      const orderArr = Array.isArray(orderBy) ? orderBy : (orderBy ? [orderBy] : []);
      // Apply sorts in reverse (last is the least significant)
      for (let i = orderArr.length - 1; i >= 0; i--) {
        const ob = orderArr[i];
        for (const key of Object.keys(ob)) {
          const dir = ob[key] === 'desc' ? -1 : 1;
          rows.sort((a, b) => {
            const av = a[key]; const bv = b[key];
            if (av === bv) return 0;
            // booleans compare numerically; dates by getTime
            const an = av instanceof Date ? av.getTime() : (typeof av === 'boolean' ? Number(av) : av);
            const bn = bv instanceof Date ? bv.getTime() : (typeof bv === 'boolean' ? Number(bv) : bv);
            return an > bn ? dir : -dir;
          });
        }
      }
      return rows;
    },
    async findFirst({ where, orderBy }) {
      const rows = await savedAddress.findMany({ where, orderBy });
      return rows[0] || null;
    },
    async findUnique({ where }) {
      return savedAddress._rows.get(where.id) || null;
    },
    async create({ data }) {
      const row = { id: newId(), createdAt: new Date(), updatedAt: new Date(), isDefault: false, ...data };
      savedAddress._rows.set(row.id, row);
      return row;
    },
    async update({ where, data }) {
      const row = savedAddress._rows.get(where.id);
      if (!row) throw new Error('savedAddress not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of savedAddress._rows.values()) {
        if (where.userId && row.userId !== where.userId) continue;
        if (where.isDefault !== undefined && row.isDefault !== where.isDefault) continue;
        if (where.NOT?.id && row.id === where.NOT.id) continue;
        Object.assign(row, data, { updatedAt: new Date() });
        count++;
      }
      return { count };
    },
    async delete({ where }) {
      const row = savedAddress._rows.get(where.id);
      savedAddress._rows.delete(where.id);
      return row;
    },
    async count({ where }) {
      let rows = [...savedAddress._rows.values()];
      if (where?.userId) rows = rows.filter((a) => a.userId === where.userId);
      return rows.length;
    },
  };

  const notification = {
    _rows: new Map(),
    seed(rows) { for (const r of rows) notification._rows.set(r.id || newId(), { ...r, id: r.id || newId() }); },
    _matches(row, where) {
      if (!where) return true;
      if (where.userId && row.userId !== where.userId) return false;
      // Prisma `readAt: null` means "unread". Anything else is a date predicate.
      if (where.readAt === null && row.readAt != null) return false;
      if (where.readAt && where.readAt !== null && row.readAt == null) return false;
      return true;
    },
    async findMany({ where, orderBy, take, skip }) {
      let rows = [...notification._rows.values()].filter((r) => notification._matches(r, where));
      if (orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt - a.createdAt);
      if (skip) rows = rows.slice(skip);
      if (take) rows = rows.slice(0, take);
      return rows;
    },
    async findUnique({ where, select }) {
      const row = notification._rows.get(where.id);
      if (!row) return null;
      if (select) return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
      return row;
    },
    async count({ where }) {
      return [...notification._rows.values()].filter((r) => notification._matches(r, where)).length;
    },
    async update({ where, data }) {
      const row = notification._rows.get(where.id);
      if (!row) throw new Error('notification not found');
      Object.assign(row, data);
      return row;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of notification._rows.values()) {
        if (!notification._matches(row, where)) continue;
        Object.assign(row, data);
        count++;
      }
      return { count };
    },
    async create({ data }) {
      const id = data.id || newId();
      const row = { id, createdAt: new Date(), readAt: null, ...data };
      notification._rows.set(id, row);
      return row;
    },
  };

  const bvnVerificationLog = {
    _rows: [],
    async create({ data }) {
      bvnVerificationLog._rows.push({ id: newId(), createdAt: new Date(), ...data });
      return { id: newId() };
    },
  };

  // Generic in-memory model: matches on `where.id`, `where.id.in`, simple
  // equality predicates, `gte`/`lte` numeric ranges, and the `category: { slug }`
  // nested predicate the search service uses. Good enough for the search +
  // nearby tests — not a full Prisma reimplementation.
  const makeGenericModel = () => {
    const rows = new Map();
    const matches = (row, where) => {
      if (!where) return true;
      for (const key of Object.keys(where)) {
        const cond = where[key];
        if (cond == null) continue;
        if (key === 'category' && cond.slug) {
          if (row.category?.slug !== cond.slug) return false;
          continue;
        }
        if (key === 'merchant' && cond) {
          if (!row.merchant) return false;
          if (cond.isActive !== undefined && row.merchant.isActive !== cond.isActive) return false;
          if (cond.adminActiveOverride !== undefined && row.merchant.adminActiveOverride !== cond.adminActiveOverride) return false;
          if (cond.category?.slug && row.merchant.category?.slug !== cond.category.slug) return false;
          continue;
        }
        if (typeof cond === 'object' && cond !== null) {
          if ('in' in cond) { if (!cond.in.includes(row[key])) return false; continue; }
          if ('gte' in cond && !(row[key] >= cond.gte)) return false;
          if ('lte' in cond && !(row[key] <= cond.lte)) return false;
          if ('not' in cond && row[key] === cond.not) return false;
          continue;
        }
        if (row[key] !== cond) return false;
      }
      return true;
    };
    return {
      _rows: rows,
      seed(items) {
        for (const it of items) {
          const id = it.id || newId();
          rows.set(id, { id, ...it });
        }
      },
      async findMany({ where, orderBy, take, skip, include, select } = {}) {
        let out = [...rows.values()].filter((r) => matches(r, where));
        const orderArr = Array.isArray(orderBy) ? orderBy : (orderBy ? [orderBy] : []);
        for (let i = orderArr.length - 1; i >= 0; i--) {
          for (const k of Object.keys(orderArr[i])) {
            const dir = orderArr[i][k] === 'desc' ? -1 : 1;
            out.sort((a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0));
          }
        }
        if (skip) out = out.slice(skip);
        if (take) out = out.slice(0, take);
        return out;
      },
      async findUnique({ where }) {
        return rows.get(where.id) || null;
      },
      async create({ data }) {
        const id = data.id || newId();
        const row = { id, ...data };
        rows.set(id, row);
        return row;
      },
      async update({ where, data }) {
        const row = rows.get(where.id);
        if (!row) throw new Error('not found');
        for (const k of Object.keys(data)) {
          const v = data[k];
          if (v && typeof v === 'object' && ('decrement' in v || 'increment' in v)) {
            row[k] = Number(row[k] || 0) + Number(v.increment || 0) - Number(v.decrement || 0);
          } else {
            row[k] = v;
          }
        }
        return row;
      },
      async count({ where } = {}) {
        return [...rows.values()].filter((r) => matches(r, where)).length;
      },
    };
  };

  const merchant = makeGenericModel();
  const product = makeGenericModel();
  const request = makeGenericModel();
  const transaction = makeGenericModel();
  const productVariant = makeGenericModel();
  const rider = makeGenericModel();
  // systemWallet is keyed by string id (e.g. 'PLATFORM_ESCROW') not uuid.
  const systemWallet = (() => {
    const rows = new Map();
    return {
      _rows: rows,
      seed(items) { for (const it of items) rows.set(it.id, { ...it }); },
      async update({ where, data }) {
        const row = rows.get(where.id) || { id: where.id, balance: 0 };
        // Support `{ decrement }` / `{ increment }` shorthand
        for (const k of Object.keys(data)) {
          const v = data[k];
          if (v && typeof v === 'object' && ('decrement' in v || 'increment' in v)) {
            const current = Number(row[k] || 0);
            row[k] = current + (Number(v.increment || 0) - Number(v.decrement || 0));
          } else {
            row[k] = v;
          }
        }
        rows.set(where.id, row);
        return row;
      },
      async findUnique({ where }) {
        return rows.get(where.id) || null;
      },
    };
  })();

  // `$queryRaw` and `$queryRawUnsafe` are tagged-template / raw-SQL escapes
  // that we can't reasonably reimplement. Tests that exercise paths using
  // these inject a custom handler via `prismaStub.$queryRaw = async () => …`.
  const $queryRaw = async () => {
    throw new Error('Tests must override prisma.$queryRaw before calling search service');
  };

  // Transactional wrapper. Real Prisma rolls back on throw; stub just sequences
  // the callback against the same mutable maps so cross-model writes settle.
  // If the callback throws, the maps already touched stay touched — fine for
  // unit tests since each test installs fresh stubs.
  const $transaction = async (input) => {
    if (typeof input === 'function') return input(prismaStubInner);
    return Promise.all(input);
  };

  // Increment/decrement support on wallet.update for the refund path.
  const walletUpdate = wallet.update;
  wallet.update = async ({ where, data }) => {
    const target = [...wallet._rows.values()].find((w) => w.userId === where.userId || w.id === where.id);
    if (!target) throw new Error('wallet not found');
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v && typeof v === 'object' && ('decrement' in v || 'increment' in v)) {
        target[k] = Number(target[k] || 0) + Number(v.increment || 0) - Number(v.decrement || 0);
      } else {
        target[k] = v;
      }
    }
    return target;
  };

  const prismaStubInner = {
    user, session, wallet, notificationPreferences, savedAddress, notification, bvnVerificationLog,
    merchant, product, request,
    transaction, productVariant, rider, systemWallet,
    $transaction, $queryRaw,
  };
  return prismaStubInner;
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

module.exports = { installStubs, clearStubs, makePrismaStub, makeRedisStub, makeAuthPrismaStub, makeRes };
