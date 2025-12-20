const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const documents = await prisma.document.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                filePath: true,
                fileName: true,
                createdAt: true
            }
        });

        console.log('Recent Documents:');
        documents.forEach(doc => {
            console.log(`ID: ${doc.id}`);
            console.log(`Title: ${doc.title}`);
            console.log(`File Name: ${doc.fileName}`);
            console.log(`File Path: ${doc.filePath}`);
            console.log(`Created At: ${doc.createdAt}`);
            console.log('---');
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
