const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Path to the Excel file
const excelFilePath = path.join(__dirname, '../public/spreadsheet/CSV 05.20.25.xlsx');

// Function to parse the Excel file
function parseExcelFile() {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile(excelFilePath);
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert the sheet to JSON
    const data = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`Total products found: ${data.length}`);
    
    // Display the first 5 products to understand the structure
    console.log('\nSample Products:');
    data.slice(0, 5).forEach((product, index) => {
      console.log(`\nProduct ${index + 1}:`);
      console.log(JSON.stringify(product, null, 2));
    });
    
    // Save the data to a JSON file for further processing
    fs.writeFileSync(
      path.join(__dirname, '../public/spreadsheet/products.json'),
      JSON.stringify(data, null, 2)
    );
    
    console.log('\nData saved to products.json');
    
    return data;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return null;
  }
}

// Execute the function
parseExcelFile();
