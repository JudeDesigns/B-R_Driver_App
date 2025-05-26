import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ProductData {
  name: string;
  sku: string;
  description?: string;
  unit?: string;
}

interface ParseResult {
  success: boolean;
  products?: ProductData[];
  errors: string[];
  warnings: string[];
  rowsProcessed: number;
  rowsSucceeded: number;
  rowsFailed: number;
}

interface ProcessResult {
  productsAdded: number;
  productsUpdated: number;
  productsFailed: number;
  totalProcessed: number;
  warnings: string[];
}

/**
 * Parse product data from Excel/CSV file
 */
export async function parseProductFile(buffer: Buffer): Promise<ParseResult> {
  try {
    // Parse the Excel file
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return {
        success: false,
        errors: ["No data found in the file"],
        warnings: [],
        rowsProcessed: 0,
        rowsSucceeded: 0,
        rowsFailed: 0,
      };
    }

    const products: ProductData[] = [];
    const warnings: string[] = [];
    let rowsSucceeded = 0;
    let rowsFailed = 0;

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      try {
        // Try different possible column names for each field and ensure they are strings
        const name = String(
          row["Product Name"] ||
            row["ProductName"] ||
            row["Name"] ||
            row["PRODUCT NAME"] ||
            row["product_name"] ||
            ""
        ).trim();
        const sku = String(
          row["SKU"] ||
            row["Sku"] ||
            row["sku"] ||
            row["Product Code"] ||
            row["ProductCode"] ||
            row["product_code"] ||
            ""
        ).trim();
        const description = String(
          row["Description"] ||
            row["description"] ||
            row["DESCRIPTION"] ||
            row["Description with additional SKU"] ||
            ""
        ).trim();
        const unit = String(
          row["Unit"] ||
            row["unit"] ||
            row["UNIT"] ||
            row["UnitOfMeasure"] ||
            row["Unit of Measure"] ||
            ""
        ).trim();

        // Check for empty values after string conversion
        if (!name || name === "undefined" || name === "null") {
          warnings.push(`Row ${i + 2}: Missing Product Name. Row skipped.`);
          rowsFailed++;
          continue;
        }

        if (!sku || sku === "undefined" || sku === "null") {
          warnings.push(`Row ${i + 2}: Missing SKU/Product Code. Row skipped.`);
          rowsFailed++;
          continue;
        }

        products.push({
          name,
          sku,
          description:
            description && description !== "undefined" && description !== "null"
              ? description
              : undefined,
          unit:
            unit && unit !== "undefined" && unit !== "null" ? unit : undefined,
        });

        rowsSucceeded++;
      } catch (error) {
        warnings.push(
          `Row ${i + 2}: Error processing row: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        rowsFailed++;
      }
    }

    return {
      success: true,
      products,
      errors: [],
      warnings,
      rowsProcessed: data.length,
      rowsSucceeded,
      rowsFailed,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Failed to parse file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      warnings: [],
      rowsProcessed: 0,
      rowsSucceeded: 0,
      rowsFailed: 0,
    };
  }
}

/**
 * Process products and save to database
 */
export async function processProducts(
  products: ProductData[]
): Promise<ProcessResult> {
  let productsAdded = 0;
  let productsUpdated = 0;
  let productsFailed = 0;
  const warnings: string[] = [];

  for (const product of products) {
    try {
      // Check if product with this SKU already exists
      const existingProduct = await prisma.product.findFirst({
        where: {
          sku: product.sku,
          isDeleted: false,
        },
      });

      if (existingProduct) {
        // Update existing product
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            name: product.name,
            description: product.description || existingProduct.description,
            unit: product.unit || existingProduct.unit,
          },
        });
        productsUpdated++;
      } else {
        // Create new product
        await prisma.product.create({
          data: {
            name: product.name,
            sku: product.sku,
            description: product.description || null,
            unit: product.unit || null,
          },
        });
        productsAdded++;
      }
    } catch (error) {
      console.error(`Error processing product ${product.sku}:`, error);
      warnings.push(
        `Failed to process product ${product.sku}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      productsFailed++;
    }
  }

  return {
    productsAdded,
    productsUpdated,
    productsFailed,
    totalProcessed: products.length,
    warnings,
  };
}
