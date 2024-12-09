import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Function to wait for database to be ready
async function waitForDatabase(timeoutMs = 60000) {
  // Skip database check during build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return true
  }

  const startTime = Date.now()
  while (Date.now() - startTime < timeoutMs) {
    try {
      const prisma = new PrismaClient()
      await prisma.$connect()
      await prisma.$disconnect()
      return true
    } catch (error: any) {
      if (!error.message.includes('Server has closed the connection')) {
        throw error
      }
      // Wait 2 seconds before trying again
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  return false
}

// Initialize Prisma Client with connection handling
async function initPrismaClient() {
  // Skip initialization during build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return new PrismaClient()
  }

  // Wait for database to be ready (max 1 minute)
  const isReady = await waitForDatabase()
  if (!isReady) {
    throw new Error('Database failed to become ready within timeout period')
  }
  return new PrismaClient()
}

// Prevent multiple instances during development
const prisma = globalForPrisma.prisma || new PrismaClient({
  // Log queries only in development
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Save reference in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { prisma } 