import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Function to wait for database to be ready
async function waitForDatabase(timeoutMs = 60000) {
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
  // Wait for database to be ready (max 1 minute)
  const isReady = await waitForDatabase()
  if (!isReady) {
    throw new Error('Database failed to become ready within timeout period')
  }
  return new PrismaClient()
}

// Use existing client or create new one
export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} 