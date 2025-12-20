const XLSX = require('xlsx');
const path = require('path');

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Define headers based on routeParser.ts analysis
const headers = [
    "Route #", "Date", "Driver", "S No", "Customers", "Customer GROUP CODE", "Customer Email",
    "Order # (Web)", "Invoice #", "NOTES to be updated at top of the INVOICE", "Notes for Drivers",
    "COD Account/ Send Inv to Customer", "Cash", "Check", "Credit Card", "Payments & Returns Remarks",
    "Other Remarks", "Amount", "Cash Amount", "Check Amount", "Credit Card Amount"
];

// Define sample data row
// Note: routeParser.ts expects specific columns at specific indices, but also looks up by name.
// Crucially, it hardcodes:
// - Driver at index 2 (Column C)
// - Invoice # at index 35 (Column AJ) - We need to ensure our row is long enough!
// - Amount at index 36 (Column AK)
// - Cash Amount at index 37 (Column AL)
// - Check Amount at index 38 (Column AM)
// - CC Amount at index 39 (Column AN)

// Let's create a row with enough empty columns to satisfy the hardcoded indices
const row = new Array(40).fill("");

// Map headers to indices (approximate, we'll fill by name where possible in a real sheet, but here we use array)
// We'll just fill the specific indices we know are critical or mapped by name
row[0] = "R100"; // Route #
row[1] = new Date().toLocaleDateString(); // Date
row[2] = "driver"; // Driver (Column C - Index 2) - MUST MATCH TEST USER
row[3] = "1"; // S No
row[4] = "Test Customer"; // Customers
row[5] = "TEST"; // Group Code
row[35] = "INV-12345"; // Invoice # (Column AJ - Index 35)
row[36] = "100.00"; // Amount (Column AK - Index 36)

// Create worksheet data
const wsData = [
    headers, // Row 1: Headers
    [],      // Row 2: Empty/Summary (parser skips row 2)
    row      // Row 3: Data
];

// Create worksheet
const worksheet = XLSX.utils.aoa_to_sheet(wsData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, "Routes");

// Write to file
XLSX.writeFile(workbook, "sample_route.xlsx");

console.log("Created sample_route.xlsx");
