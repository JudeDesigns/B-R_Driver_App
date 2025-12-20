import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Configure Prisma client with optimized settings
const prismaClientSingleton = () => {
  const options: any = {
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  };

  if (process.env.NODE_ENV !== "production") {
    options.log = [
      {
        emit: "event",
        level: "query",
      },
    ];
  }

  return new PrismaClient(options);
};

// Use global variable to prevent multiple instances in development
export const prisma = global.prisma || prismaClientSingleton();

// Add query logging in development mode
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;

  // Log slow queries to help identify performance bottlenecks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (e: any) => {
    if (e.duration > 200) {
      // Log queries that take more than 200ms
      console.log(`Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}

export default prisma;
