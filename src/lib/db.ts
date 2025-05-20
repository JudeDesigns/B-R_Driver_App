import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Configure Prisma client with optimized settings
const prismaClientSingleton = () => {
  // In development, log queries to help with debugging and optimization
  const logOptions =
    process.env.NODE_ENV !== "production"
      ? {
          log: [
            {
              emit: "event",
              level: "query",
            },
          ],
        }
      : {};

  // Configure connection pool for better performance
  return new PrismaClient({
    ...logOptions,
    // Optimize connection pool settings
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

// Use global variable to prevent multiple instances in development
export const prisma = global.prisma || prismaClientSingleton();

// Add query logging in development mode
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;

  // Log slow queries to help identify performance bottlenecks
  prisma.$on("query", (e: any) => {
    if (e.duration > 200) {
      // Log queries that take more than 200ms
      console.log(`Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}

export default prisma;
