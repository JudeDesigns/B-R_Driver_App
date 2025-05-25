const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Path to the analyzed products JSON file
const productsJsonPath = path.join(__dirname, '../public/spreadsheet/analyzed_product_data.json');

// Function to extract additional SKUs from the filtered additional SKUs string
function parseAdditionalSKUs(skuString) {
  if (!skuString || typeof skuString !== 'string' || skuString.trim() === '') {
    return [];
  }
  
  return skuString.split(',').map(sku => sku.trim()).filter(sku => sku !== '');
}

// Function to import products into the database
async function importProducts() {
  try {
    // Read the analyzed products JSON file
    const productsData = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));
    
    console.log(`Total products to import: ${productsData.length}`);
    
    // Count for progress tracking
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process products in batches to avoid memory issues
    const batchSize = 100;
    const totalBatches = Math.ceil(productsData.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min((batchIndex + 1) * batchSize, productsData.length);
      const batch = productsData.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batchStart + 1}-${batchEnd} of ${productsData.length})`);
      
      // Process each product in the batch
      for (const productData of batch) {
        try {
          const productCode = productData['Product Code'];
          
          // Check if product already exists
          const existingProduct = await prisma.product.findUnique({
            where: { productCode },
          });
          
          if (existingProduct) {
            console.log(`Product with code ${productCode} already exists. Skipping.`);
            skippedCount++;
            continue;
          }
          
          // Extract additional SKUs
          const additionalSKUsString = productData['Filtered Additional SKUs'] || '';
          const additionalSKUs = parseAdditionalSKUs(additionalSKUsString);
          
          // Create the product with its additional SKUs
          const product = await prisma.product.create({
            data: {
              productName: productData['Product Name'] || '',
              productCode: productCode,
              unit: productData['Unit'] || null,
              description: productData['Description with additional SKU'] || null,
              additionalSKUs: {
                create: additionalSKUs.map(sku => ({
                  skuCode: sku,
                  description: `Additional SKU extracted from product description`,
                })),
              },
              // Create initial inventory record with zero quantity
              inventory: {
                create: {
                  quantity: 0,
                  unit: productData['Unit'] || 'UNIT',
                  reorderLevel: 10, // Default reorder level
                },
              },
            },
          });
          
          importedCount++;
          
          // Log progress every 100 products
          if (importedCount % 100 === 0) {
            console.log(`Imported ${importedCount} products so far...`);
          }
        } catch (error) {
          console.error(`Error importing product ${productData['Product Code']}:`, error);
          errorCount++;
        }
      }
    }
    
    console.log('\nImport completed:');
    console.log(`- Successfully imported: ${importedCount} products`);
    console.log(`- Skipped (already exist): ${skippedCount} products`);
    console.log(`- Errors: ${errorCount} products`);
    
  } catch (error) {
    console.error('Error importing products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the function
importProducts()
  .then(() => console.log('Import process completed.'))
  .catch((error) => console.error('Import process failed:', error));
