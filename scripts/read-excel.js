const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Path to the Excel file
const excelFilePath = path.join(__dirname, '../public/spreadsheet/Daily Tasks Report 05.01.25.xlsx');

// Read the Excel file
const workbook = XLSX.read(fs.readFileSync(excelFilePath), { type: 'buffer' });

// Get the first worksheet
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Print the first few rows to understand the structure
console.log('First 10 rows:');
data.slice(0, 10).forEach((row, index) => {
  console.log(`Row ${index + 1}:`, row);
});

// Print column headers (assuming first row contains headers)
console.log('\nColumn Headers:');
if (data.length > 0) {
  data[0].forEach((header, index) => {
    const colLetter = XLSX.utils.encode_col(index);
    console.log(`Column ${colLetter} (${index + 1}): ${header || 'Empty'}`);
  });
}

// Print specific columns mentioned in the requirements
console.log('\nSpecific Columns:');
const specificColumns = {
  'C': 'Assigned Driver',
  'F': 'Customer Name',
  'P': 'Web Order/Orders #',
  'AC': 'Notes for Driver',
  'AI': 'QuickBooks Invoice #',
  'AD': 'COD Account Flag',
  'AK-AN': 'Payment Method Flags',
  'AQ': 'Return Flag',
  'AR': 'Driver Remark'
};

Object.entries(specificColumns).forEach(([col, description]) => {
  if (col.includes('-')) {
    // Range of columns
    const [start, end] = col.split('-');
    const startIdx = XLSX.utils.decode_col(start);
    const endIdx = XLSX.utils.decode_col(end);
    console.log(`Columns ${col} (${description}):`);
    for (let i = startIdx; i <= endIdx; i++) {
      const colLetter = XLSX.utils.encode_col(i);
      console.log(`  Column ${colLetter} (${i + 1}): ${data[0][i] || 'Empty'}`);
    }
  } else {
    // Single column
    const colIdx = XLSX.utils.decode_col(col);
    console.log(`Column ${col} (${description}): ${data[0][colIdx] || 'Empty'}`);
  }
});

// Sample data rows
console.log('\nSample Data Rows:');
// Skip header row and print a few data rows
data.slice(1, 6).forEach((row, index) => {
  console.log(`Data Row ${index + 1}:`);
  Object.entries(specificColumns).forEach(([col, description]) => {
    if (col.includes('-')) {
      // Range of columns
      const [start, end] = col.split('-');
      const startIdx = XLSX.utils.decode_col(start);
      const endIdx = XLSX.utils.decode_col(end);
      console.log(`  ${description}:`);
      for (let i = startIdx; i <= endIdx; i++) {
        const colLetter = XLSX.utils.encode_col(i);
        console.log(`    Column ${colLetter}: ${row[i] || 'Empty'}`);
      }
    } else {
      // Single column
      const colIdx = XLSX.utils.decode_col(col);
      console.log(`  ${description}: ${row[colIdx] || 'Empty'}`);
    }
  });
});
