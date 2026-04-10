/**
 * Prisma client singleton.
 *
 * NEVER instantiate PrismaClient anywhere else.
 * Always import from this file:
 *   const { prisma } = require('../config/database');
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
});

module.exports = { prisma };
