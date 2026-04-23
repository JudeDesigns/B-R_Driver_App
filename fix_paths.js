const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({
    where: {
      filePath: {
        not: {
          startsWith: '/uploads/'
        }
      }
    }
  });
  
  for (const doc of docs) {
    if (!doc.filePath.startsWith('/uploads/')) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { filePath: `/uploads/${doc.filePath}` }
      });
      console.log(`Updated doc ${doc.id}: /uploads/${doc.filePath}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
