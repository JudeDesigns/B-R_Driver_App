const fs = require('fs');
const path = require('path');

// Path to the products JSON file
const productsJsonPath = path.join(__dirname, '../public/spreadsheet/products.json');

// Function to extract potential additional SKUs from description
function extractAdditionalSKUs(description, productCode) {
  if (!description || typeof description !== 'string') {
    return [];
  }

  // Extract text in parentheses
  const parenthesesRegex = /\(([^)]+)\)/g;
  const parenthesesMatches = [...description.matchAll(parenthesesRegex)].map(match => match[1]);

  // Extract alphanumeric codes with hyphens (common SKU format)
  const skuRegex = /\b([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/g;
  const skuMatches = [...description.matchAll(skuRegex)].map(match => match[1]);

  // Combine all potential SKUs
  let potentialSKUs = [...parenthesesMatches, ...skuMatches];

  // Filter out the main product code and common non-SKU patterns
  potentialSKUs = potentialSKUs.filter(sku => {
    // Skip if it's the main product code
    if (sku === productCode) return false;
    
    // Skip common quantity notations like "2/11 LBS"
    if (/^\d+\/\d+\s*(?:LBS|OZ|CT|PCS)$/i.test(sku)) return false;
    
    // Skip common size notations
    if (/^\d+x\d+(?:x\d+)?$/i.test(sku)) return false;
    
    return true;
  });

  // Remove duplicates
  return [...new Set(potentialSKUs)];
}

// Function to analyze the products
function analyzeProducts() {
  try {
    // Read the products JSON file
    const productsData = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));
    
    console.log(`Total products: ${productsData.length}`);
    
    // Count unique product names
    const uniqueProductNames = new Set(productsData.map(product => product['Product Name']));
    console.log(`Unique product names: ${uniqueProductNames.size}`);
    
    // Count unique product codes
    const uniqueProductCodes = new Set(productsData.map(product => product['Product Code']));
    console.log(`Unique product codes: ${uniqueProductCodes.size}`);
    
    // Count products by unit
    const unitCounts = {};
    productsData.forEach(product => {
      const unit = product['Unit'] || 'Unknown';
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });
    
    console.log('\nProducts by Unit:');
    Object.entries(unitCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([unit, count]) => {
        console.log(`${unit}: ${count}`);
      });
    
    // Count missing values
    const missingUnit = productsData.filter(product => !product['Unit']).length;
    const missingDescription = productsData.filter(product => !product['Description with additional SKU']).length;
    
    console.log('\nMissing Values:');
    console.log(`Missing Unit: ${missingUnit}`);
    console.log(`Missing Description: ${missingDescription}`);
    
    // Extract and analyze additional SKUs
    const productsWithAdditionalSKUs = [];
    
    productsData.forEach(product => {
      const productCode = product['Product Code'];
      const description = product['Description with additional SKU'];
      
      const additionalSKUs = extractAdditionalSKUs(description, productCode);
      
      if (additionalSKUs.length > 0) {
        productsWithAdditionalSKUs.push({
          ...product,
          'Potential Additional SKUs': additionalSKUs,
          'Filtered Additional SKUs': additionalSKUs
        });
      }
    });
    
    console.log(`\nProducts with potential additional SKUs: ${productsWithAdditionalSKUs.length}`);
    
    // Save products with additional SKUs to a separate file
    fs.writeFileSync(
      path.join(__dirname, '../public/spreadsheet/products_with_additional_skus.json'),
      JSON.stringify(productsWithAdditionalSKUs, null, 2)
    );
    
    // Create a CSV file for products with additional SKUs
    const csvHeader = 'Product Name,Product Code,Unit,Description with additional SKU,Filtered Additional SKUs\n';
    const csvRows = productsWithAdditionalSKUs.map(product => {
      return [
        `"${product['Product Name'].replace(/"/g, '""')}"`,
        `"${product['Product Code']}"`,
        `"${product['Unit'] || ''}"`,
        `"${(product['Description with additional SKU'] || '').toString().replace(/"/g, '""')}"`,
        `"${product['Filtered Additional SKUs'].join(', ')}"`
      ].join(',');
    });
    
    fs.writeFileSync(
      path.join(__dirname, '../public/spreadsheet/products_with_additional_skus.csv'),
      csvHeader + csvRows.join('\n')
    );
    
    // Create a full analyzed dataset with additional columns
    const analyzedData = productsData.map(product => {
      const productCode = product['Product Code'];
      const description = product['Description with additional SKU'];
      
      const additionalSKUs = extractAdditionalSKUs(description, productCode);
      
      return {
        ...product,
        'Potential Additional SKUs': additionalSKUs.join(', '),
        'Filtered Additional SKUs': additionalSKUs.join(', '),
        'Has Additional SKU': additionalSKUs.length > 0 ? 'Yes' : 'No'
      };
    });
    
    fs.writeFileSync(
      path.join(__dirname, '../public/spreadsheet/analyzed_product_data.json'),
      JSON.stringify(analyzedData, null, 2)
    );
    
    // Create a CSV file for the full analyzed dataset
    const fullCsvHeader = 'Product Name,Product Code,Unit,Description with additional SKU,Potential Additional SKUs,Filtered Additional SKUs,Has Additional SKU\n';
    const fullCsvRows = analyzedData.map(product => {
      return [
        `"${product['Product Name'].replace(/"/g, '""')}"`,
        `"${product['Product Code']}"`,
        `"${product['Unit'] || ''}"`,
        `"${(product['Description with additional SKU'] || '').toString().replace(/"/g, '""')}"`,
        `"${product['Potential Additional SKUs']}"`,
        `"${product['Filtered Additional SKUs']}"`,
        `"${product['Has Additional SKU']}"`
      ].join(',');
    });
    
    fs.writeFileSync(
      path.join(__dirname, '../public/spreadsheet/analyzed_product_data.csv'),
      fullCsvHeader + fullCsvRows.join('\n')
    );
    
    console.log('\nAnalysis complete. Files saved:');
    console.log('- products_with_additional_skus.json');
    console.log('- products_with_additional_skus.csv');
    console.log('- analyzed_product_data.json');
    console.log('- analyzed_product_data.csv');
    
    return {
      totalProducts: productsData.length,
      uniqueProductNames: uniqueProductNames.size,
      uniqueProductCodes: uniqueProductCodes.size,
      unitCounts,
      missingUnit,
      missingDescription,
      productsWithAdditionalSKUs: productsWithAdditionalSKUs.length
    };
  } catch (error) {
    console.error('Error analyzing products:', error);
    return null;
  }
}

// Execute the function
analyzeProducts();
