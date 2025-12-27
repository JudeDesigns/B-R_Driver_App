import * as XLSX from "xlsx";
import { PrismaClient, User, Customer, Route, Stop } from "@prisma/client";
import prisma from "./db";
import { InputValidator } from "./security";
import { createPSTDate, getPSTDateString } from "./timezone";
import { shouldIgnoreDriver, shouldIgnoreCustomer } from "./routeValidation";

// Define the structure for a parsed stop
export interface ParsedStop {
  sequence: number;
  customerName: string;
  driverName: string; // Added driver name to each stop
  customerGroupCode?: string;
  customerEmail?: string; // Added customer email
  orderNumberWeb?: string;
  quickbooksInvoiceNum?: string;
  initialDriverNotes?: string;
  adminNotes?: string; // Added admin notes from AC column
  isCOD: boolean;
  paymentFlagCash: boolean;
  paymentFlagCheck: boolean;
  paymentFlagCC: boolean;
  paymentFlagNotPaid: boolean;
  returnFlagInitial: boolean;
  driverRemarkInitial?: string;
  amount?: number;
  // Payment amounts from Excel columns AK, AL, AM
  paymentAmountCash?: number; // Column AK
  paymentAmountCheck?: number; // Column AL
  paymentAmountCC?: number; // Column AM
  totalPaymentAmount?: number; // Sum of all payment amounts
}



// Define the structure for a parsed route
export interface ParsedRoute {
  routeNumber: string;
  driverName: string;
  date: Date;
  stops: ParsedStop[];
}

// Define the structure for parsing results
export interface ParsingResult {
  success: boolean;
  route?: ParsedRoute;
  errors: string[];
  warnings: string[];
  rowsProcessed: number;
  rowsSucceeded: number;
  rowsFailed: number;
}

/**
 * Parse an Excel file buffer into route data
 * @param buffer The Excel file buffer
 * @returns Parsing result with route data or errors
 */
export async function parseRouteExcel(buffer: Buffer): Promise<ParsingResult> {
  const result: ParsingResult = {
    success: false,
    errors: [],
    warnings: [],
    rowsProcessed: 0,
    rowsSucceeded: 0,
    rowsFailed: 0,
  };

  try {
    // Validate buffer size (max 10MB for security)
    if (buffer.length > 10 * 1024 * 1024) {
      result.errors.push("File size too large. Maximum allowed size is 10MB.");
      return result;
    }

    // Validate buffer is not empty
    if (buffer.length === 0) {
      result.errors.push("File is empty.");
      return result;
    }
    // Performance optimization: Use optimized XLSX reading options
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: false, // Disable formula parsing for better performance
      cellHTML: false, // Disable HTML parsing for better performance
      cellText: false, // Disable text parsing for better performance
      cellDates: true, // Keep date parsing for proper date handling
      cellNF: false, // Disable number format parsing for better performance
      cellStyles: false, // Disable style parsing for better performance
      sheetStubs: false, // Ignore empty cells for better performance
    });

    // Get the first worksheet
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to JSON with headers - optimize with defval to handle empty cells
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null, // Use null for empty cells for faster processing
      blankrows: false, // Skip blank rows for better performance
    });

    if (data.length < 2) {
      result.errors.push("Excel file does not contain enough data");
      return result;
    }

    // Extract headers (first row)
    const headers = data[0] as string[];

    // Performance optimization: Create a map of header names to indices for faster lookups
    const headerMap = new Map<string, number>();
    headers.forEach((header, index) => {
      if (header) headerMap.set(header, index);
    });

    // Find column indices based on headers - optimized with Map for O(1) lookups
    const columnIndices = {
      routeNumber: headerMap.get("Route #") ?? -1,
      driver: headerMap.get("Driver") ?? -1, // Use the Driver column from headers
      sequence: headerMap.get("S No") ?? 0, // Use S No column for sequence numbers
      customerName: headerMap.get("Customers") ?? -1,
      customerGroupCode: headerMap.get("Customer GROUP CODE") ?? -1,
      customerEmail: headerMap.get("Customer Email") ?? -1,
      orderNumberWeb: headerMap.get("Order # (Web)") ?? -1,
      // Try multiple possible column names for date
      date:
        headerMap.get("Date") ??
        headerMap.get("Route Date") ??
        headerMap.get("Delivery Date") ??
        headerMap.get("Schedule Date") ??
        -1,
      // Try multiple possible column names for invoice number
      quickbooksInvoiceNum:
        headerMap.get("Invoice #") ??
        headerMap.get("Invoice#") ??
        headerMap.get("Invoice") ??
        headerMap.get("QB Invoice #") ??
        headerMap.get("QB Invoice") ??
        -1,
      initialDriverNotes:
        headerMap.get("NOTES to be updated at top of the INVOICE") ?? -1,
      adminNotes: headerMap.get("Notes for Drivers") ?? -1, // AC column - Notes for Drivers
      codFlag: headerMap.get("COD Account/ Send Inv to Customer") ?? -1,
      paymentFlagCash: headerMap.get("Cash") ?? -1,
      paymentFlagCheck: headerMap.get("Check") ?? -1,
      paymentFlagCC: headerMap.get("Credit Card") ?? -1,
      returnFlag: headerMap.get("Payments & Returns Remarks") ?? -1,
      driverRemark: headerMap.get("Other Remarks") ?? -1,
      amount: headerMap.get("Amount") ?? -1,
      // Payment amount columns (will be overridden with fixed positions)
      paymentAmountCash: headerMap.get("Cash Amount") ?? -1, // Column AK
      paymentAmountCheck: headerMap.get("Check Amount") ?? -1, // Column AL
      paymentAmountCC: headerMap.get("Credit Card Amount") ?? -1, // Column AM
    };

    // Always use column AJ (index 35) for invoice numbers as specified
    // This overrides any column mapping that might have been found by name
    columnIndices.quickbooksInvoiceNum = 35; // Column AJ (0-based index)
    console.log("Using column AJ (index 35) for invoice numbers as specified");

    // Always use column C (index 2) for driver names as specified
    // This overrides any column mapping that might have been found by name
    columnIndices.driver = 2; // Column C (0-based index)
    console.log("Using column C (index 2) for driver names as specified");

    // Fix column mapping: AK is for Amount, AL/AM/AN are for payment amounts
    // AK = 36 (Amount - invoice total)
    // AL = 37 (Cash Payment Amount)
    // AM = 38 (Check Payment Amount)
    // AN = 39 (Credit Card Payment Amount)
    columnIndices.amount = 36; // Column AK - Invoice Amount
    columnIndices.paymentAmountCash = 37; // Column AL - Cash Payment
    columnIndices.paymentAmountCheck = 38; // Column AM - Check Payment
    columnIndices.paymentAmountCC = 39; // Column AN - Credit Card Payment
    console.log("Fixed column mapping: AK=Amount(36), AL=Cash(37), AM=Check(38), AN=CC(39)");

    // Log the headers and column indices for debugging
    console.log("Excel Headers:", headers);
    console.log("Column Indices:", columnIndices);

    // CRITICAL DEBUG: Check for column conflicts
    console.log("=== COLUMN MAPPING DEBUG ===");
    console.log(`Amount column index: ${columnIndices.amount} (Header: "${headers[columnIndices.amount]}")`);
    console.log(`Cash payment column index: ${columnIndices.paymentAmountCash} (Header: "${headers[columnIndices.paymentAmountCash]}")`);
    console.log(`Check payment column index: ${columnIndices.paymentAmountCheck} (Header: "${headers[columnIndices.paymentAmountCheck]}")`);
    console.log(`CC payment column index: ${columnIndices.paymentAmountCC} (Header: "${headers[columnIndices.paymentAmountCC]}")`);

    // Check for conflicts
    if (columnIndices.amount === columnIndices.paymentAmountCash) {
      console.error("🚨 CONFLICT: Amount and Cash Payment are using the same column!");
    }
    if (columnIndices.amount === columnIndices.paymentAmountCheck) {
      console.error("🚨 CONFLICT: Amount and Check Payment are using the same column!");
    }
    if (columnIndices.amount === columnIndices.paymentAmountCC) {
      console.error("🚨 CONFLICT: Amount and Credit Card Payment are using the same column!");
    }
    console.log("=== END COLUMN DEBUG ===");

    // Validate that we found all required columns
    const requiredColumns = [
      "routeNumber",
      "driver",
      "sequence",
      "customerName",
    ];
    for (const col of requiredColumns) {
      if (columnIndices[col as keyof typeof columnIndices] === -1) {
        result.errors.push(
          `Required column '${col}' not found in the Excel file`
        );
      }
    }

    if (result.errors.length > 0) {
      return result;
    }

    // Initialize route data with today's date in PST timezone
    // createPSTDate() without parameters now correctly returns start of today in PST
    const today = createPSTDate();

    // Debug logging for route initialization
    console.log(`[ROUTE PARSER] Initializing route with today's date:`, {
      todayUTC: today.toISOString(),
      todayPST: today.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
      isDST: today.toLocaleString("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" }).includes("PDT")
    });

    const route: ParsedRoute = {
      routeNumber: "",
      driverName: "",
      date: today, // Will be updated from Excel data if available
      stops: [],
    };

    // Performance optimization: Pre-allocate array for stops to avoid resizing
    const estimatedStopCount = Math.max(50, Math.floor(data.length * 0.8));
    const stops: ParsedStop[] = [];
    stops.length = estimatedStopCount;
    let stopIndex = 0;

    // Process data rows (skip header row and summary rows)
    // Performance optimization: Use for-of loop for better performance with large arrays
    let rowIndex = 2; // Start from row 3 (index 2)
    for (const row of data.slice(2)) {
      result.rowsProcessed++;
      rowIndex++;

      // Skip empty rows or summary rows - optimized null check
      if (!row || !(row as any[])[columnIndices.customerName]) {
        continue;
      }

      try {
        // Extract route information from the first valid row
        if (!route.routeNumber && row[columnIndices.routeNumber]) {
          route.routeNumber = row[columnIndices.routeNumber].toString();
        }

        // Extract route date from Excel if available
        if (columnIndices.date !== -1 && row[columnIndices.date]) {
          try {
            const dateValue = row[columnIndices.date];
            let parsedDate: Date;

            if (dateValue instanceof Date) {
              parsedDate = new Date(dateValue);
            } else if (typeof dateValue === 'number') {
              // Excel date serial number
              parsedDate = new Date((dateValue - 25569) * 86400 * 1000);
            } else {
              // Try to parse as string
              parsedDate = new Date(dateValue.toString());
            }

            // Validate and normalize the parsed date to PST timezone
            if (!isNaN(parsedDate.getTime())) {
              // Convert to PST timezone - createPSTDate now handles timezone correctly
              const pstDate = createPSTDate(parsedDate.getFullYear(), parsedDate.getMonth() + 1, parsedDate.getDate());
              route.date = pstDate;

              // Debug logging for route date assignment
              console.log(`[ROUTE PARSER] Route date set from Excel:`, {
                originalValue: dateValue,
                parsedDate: parsedDate.toISOString(),
                pstDate: pstDate.toISOString(),
                pstDisplay: pstDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
              });
            }
          } catch (error) {
            console.warn(`Failed to parse date from Excel: ${row[columnIndices.date]}`, error);
          }
        }

        // Only set the route's driver name if it's not already set and the current row has a valid driver
        if (!route.driverName && row[columnIndices.driver]) {
          const driverName = row[columnIndices.driver].toString();
          if (!shouldIgnoreDriver(driverName)) {
            route.driverName = driverName;
          }
        }

        // Get the driver name from the row
        const rawDriverName = row[columnIndices.driver]?.toString() || "";

        // Check if this driver should be ignored
        if (shouldIgnoreDriver(rawDriverName)) {
          result.warnings.push(
            `Row ${rowIndex}: Ignored row with invalid driver name: "${rawDriverName}"`
          );
          result.rowsFailed++;
          continue;
        }

        // Extract and validate stop information
        const rawCustomerName =
          row[columnIndices.customerName]?.toString() || "";
        const rawSequence = row[columnIndices.sequence]?.toString() || "0";

        // Validate and sanitize customer name (preserve business characters like & and ')
        let customerName = "";
        try {
          customerName = InputValidator.sanitizeCustomerName(rawCustomerName, 100);
          if (customerName.length < 2) {
            throw new Error("Customer name too short");
          }
        } catch (error) {
          result.warnings.push(
            `Row ${rowIndex}: Invalid customer name: "${rawCustomerName}"`
          );
          result.rowsFailed++;
          continue;
        }

        // Validate sequence number
        const sequence = parseInt(rawSequence);
        if (isNaN(sequence) || sequence < 0 || sequence > 9999) {
          result.warnings.push(
            `Row ${rowIndex}: Invalid sequence number: "${rawSequence}"`
          );
          result.rowsFailed++;
          continue;
        }

        const stop: ParsedStop = {
          sequence: sequence,
          customerName: customerName,
          driverName: rawDriverName, // Capture driver for each stop
          customerGroupCode:
            row[columnIndices.customerGroupCode]?.toString() || undefined,
          customerEmail:
            row[columnIndices.customerEmail]?.toString() || undefined,
          orderNumberWeb: (() => {
            const rawValue = row[columnIndices.orderNumberWeb];
            return rawValue !== undefined && rawValue !== null
              ? rawValue.toString().trim()
              : "";
          })(),
          quickbooksInvoiceNum: (() => {
            // ONLY use column AJ (index 35) for invoice numbers - no fallback logic
            // This prevents web order numbers from being incorrectly used as invoice numbers

            let rawValue = row[35]; // Column AJ (0-based index)
            let invoiceNum: string = "";

            if (rawValue !== undefined && rawValue !== null) {
              // Convert to string and trim whitespace
              invoiceNum = rawValue.toString().trim();
            }

            // Enhanced debug logging to track the exact values
            console.log(`Row ${rowIndex} - Invoice # Debug:`, {
              customerName: row[columnIndices.customerName]?.toString() || "",
              columnAJ_index35: row[35],
              columnAJ_type: typeof row[35],
              columnAJ_isEmpty: row[35] === undefined || row[35] === null || row[35] === "",
              finalInvoiceNum: invoiceNum,
              webOrderColumn: row[columnIndices.orderNumberWeb],
              webOrderValue: row[columnIndices.orderNumberWeb]?.toString() || "",
            });

            return invoiceNum; // Return empty string if column AJ is empty
          })(),
          initialDriverNotes:
            row[columnIndices.initialDriverNotes]?.toString() || undefined,
          adminNotes: row[columnIndices.adminNotes]?.toString() || undefined, // Get admin notes from AC column
          isCOD:
            row[columnIndices.codFlag]
              ?.toString()
              .toLowerCase()
              .includes("cod") || false,
          paymentFlagCash:
            !!row[columnIndices.paymentFlagCash] &&
            parseFloat(row[columnIndices.paymentFlagCash]) > 0,
          paymentFlagCheck:
            !!row[columnIndices.paymentFlagCheck] &&
            parseFloat(row[columnIndices.paymentFlagCheck]) > 0,
          paymentFlagCC:
            !!row[columnIndices.paymentFlagCC] &&
            parseFloat(row[columnIndices.paymentFlagCC]) > 0,
          paymentFlagNotPaid: false, // Will be calculated below
          returnFlagInitial:
            !!row[columnIndices.returnFlag] &&
            row[columnIndices.returnFlag].toString().trim() !== "",
          driverRemarkInitial:
            row[columnIndices.driverRemark]?.toString() || undefined,
          amount: row[columnIndices.amount]
            ? parseFloat(row[columnIndices.amount])
            : undefined,
          // Extract payment amounts from Excel columns AL, AM, AN
          // Only set values if they exist and are greater than 0, otherwise undefined
          paymentAmountCash: (() => {
            const rawValue = row[columnIndices.paymentAmountCash];
            const parsed = rawValue && !isNaN(parseFloat(rawValue)) ? parseFloat(rawValue) : 0;
            return parsed > 0 ? parsed : undefined;
          })(),
          paymentAmountCheck: (() => {
            const rawValue = row[columnIndices.paymentAmountCheck];
            const parsed = rawValue && !isNaN(parseFloat(rawValue)) ? parseFloat(rawValue) : 0;
            return parsed > 0 ? parsed : undefined;
          })(),
          paymentAmountCC: (() => {
            const rawValue = row[columnIndices.paymentAmountCC];
            const parsed = rawValue && !isNaN(parseFloat(rawValue)) ? parseFloat(rawValue) : 0;
            return parsed > 0 ? parsed : undefined;
          })(),
        };

        // Calculate total payment amount only if any payment amounts are defined
        const hasPaymentAmounts = stop.paymentAmountCash !== undefined ||
                                 stop.paymentAmountCheck !== undefined ||
                                 stop.paymentAmountCC !== undefined;

        if (hasPaymentAmounts) {
          stop.totalPaymentAmount = (stop.paymentAmountCash || 0) +
                                   (stop.paymentAmountCheck || 0) +
                                   (stop.paymentAmountCC || 0);
        } else {
          stop.totalPaymentAmount = undefined;
        }

        // Calculate paymentFlagNotPaid
        stop.paymentFlagNotPaid =
          !stop.paymentFlagCash &&
          !stop.paymentFlagCheck &&
          !stop.paymentFlagCC;

        // Validate stop data
        if (!stop.customerName) {
          result.warnings.push(`Row ${rowIndex}: Missing customer name`);
          result.rowsFailed++;
          continue;
        }

        // Check if this customer should be ignored (email addresses, documentation entries, etc.)
        if (shouldIgnoreCustomer(stop.customerName)) {
          result.warnings.push(
            `Row ${rowIndex}: Ignored row with invalid customer name: "${stop.customerName}"`
          );
          result.rowsFailed++;
          continue;
        }

        if (isNaN(stop.sequence) || stop.sequence <= 0) {
          result.warnings.push(
            `Row ${rowIndex}: Invalid sequence number for customer ${stop.customerName}`
          );
          // Still add the stop but with a default sequence
          stop.sequence = route.stops.length + 1;
        }

        // Add the stop to our pre-allocated array
        if (stopIndex < estimatedStopCount) {
          stops[stopIndex++] = stop;
        } else {
          // If we exceed our pre-allocated size, push to the array
          stops.push(stop);
          stopIndex++;
        }
        result.rowsSucceeded++;
      } catch (error) {
        result.warnings.push(
          `Row ${rowIndex}: Error processing row - ${(error as Error).message}`
        );
        result.rowsFailed++;
      }
    }

    // Trim the stops array to the actual size and assign to route
    route.stops = stops.slice(0, stopIndex);

    // Final validation
    if (route.stops.length === 0) {
      result.errors.push("No valid stops found in the Excel file");
      return result;
    }

    result.route = route;
    result.success = true;

    return result;
  } catch (error) {
    result.errors.push(`Error parsing Excel file: ${(error as Error).message}`);
    return result;
  }
}

/**
 * Save a parsed route to the database or update if it already exists
 * @param parsedRoute The parsed route data
 * @param uploadedBy ID of the admin who uploaded the route
 * @param fileName Name of the uploaded file
 * @param action Action to take: 'create', 'update', or null for auto-detect
 * @returns The created or updated route with stops
 */
export async function saveRouteToDatabase(
  parsedRoute: ParsedRoute,
  uploadedBy: string,
  fileName: string,
  action?: string | null
): Promise<{ route: Route; isUpdate: boolean }> {
  // Performance optimization: Use a more efficient transaction with optimized batch operations
  return await prisma.$transaction(async (tx) => {
    // Initialize customerInvoiceMap at the top level of the transaction
    // This map will store existing invoice numbers for customers when updating a route
    const customerInvoiceMap = new Map<
      string,
      {
        quickbooksInvoiceNum: string | null;
        orderNumberWeb: string | null;
      }
    >();

    // Flag to track if this is an update to an existing route
    let isUpdate = false;

    // Filter out any stops with invalid driver names or customer names that might have slipped through
    // Performance optimization: Use a more efficient filter with early returns
    const validStops: ParsedStop[] = [];
    for (const stop of parsedRoute.stops) {
      if (
        shouldIgnoreDriver(stop.driverName) ||
        shouldIgnoreCustomer(stop.customerName)
      ) {
        continue;
      }
      validStops.push(stop);
    }
    parsedRoute.stops = validStops;

    // Performance optimization: Use a Set for O(1) lookups of unique driver names
    const driverNamesSet = new Set<string>();
    for (const stop of parsedRoute.stops) {
      if (stop.driverName) {
        driverNamesSet.add(stop.driverName);
      }
    }
    const driverNames = Array.from(driverNamesSet);

    // Map to store driver objects by name for quick lookup
    const driverMap = new Map<string, User>();

    // Performance optimization: Batch query existing drivers first
    // Query for active drivers with DRIVER role
    const existingDrivers = await tx.user.findMany({
      where: {
        username: {
          in: driverNames,
        },
        role: "DRIVER",
        isDeleted: false,
      },
    });

    // Add existing drivers to the map
    for (const driver of existingDrivers) {
      driverMap.set(driver.username, driver);
    }

    // IMPORTANT: Also check for ANY users with these usernames (regardless of role/deletion status)
    // to prevent unique constraint violations
    const allExistingUsers = await tx.user.findMany({
      where: {
        username: {
          in: driverNames,
        },
      },
      select: {
        username: true,
        role: true,
        isDeleted: true,
      },
    });

    // Create a set of usernames that already exist in the database
    const existingUsernames = new Set(allExistingUsers.map(u => u.username));

    // Process each missing driver
    const missingDriverNames = driverNames.filter(
      (name) => !driverMap.has(name) && !existingUsernames.has(name)
    );

    // Log warnings for usernames that exist but aren't active drivers
    for (const user of allExistingUsers) {
      if (!driverMap.has(user.username)) {
        console.warn(
          `[ROUTE UPLOAD] Username "${user.username}" already exists with role: ${user.role}, isDeleted: ${user.isDeleted}. ` +
          `Cannot create as DRIVER. Please use a different username or update the existing user.`
        );
      }
    }

    // Performance optimization: Process drivers in parallel batches
    const driverCreationPromises = missingDriverNames.map(
      async (driverName) => {
        try {
          // Generate a default password based on the driver's name: {name}123
          const defaultPassword = `${driverName}123`;
          // Note: In production, consider implementing stronger password policies
          // and requiring drivers to change their password on first login
          const hashedPassword = defaultPassword;

          // Create the new driver
          const driver = await tx.user.create({
            data: {
              username: driverName,
              password: hashedPassword,
              role: "DRIVER",
              fullName: driverName, // Use the same name for fullName initially
            },
          });

          console.log(
            `[ROUTE UPLOAD] Created new driver: ${driverName} with default password`
          );

          return driver;
        } catch (error) {
          // If there's an error creating the driver (e.g., duplicate username with different case)
          // Log the error but don't throw - this allows the route upload to continue
          console.error(
            `[ROUTE UPLOAD] Failed to create driver "${driverName}": ${
              (error as Error).message
            }`
          );

          // Try to find if this user exists with a different case or status
          const existingUser = await tx.user.findFirst({
            where: {
              username: {
                equals: driverName,
                mode: 'insensitive', // Case-insensitive search
              },
            },
          });

          if (existingUser) {
            console.warn(
              `[ROUTE UPLOAD] Found existing user "${existingUser.username}" (role: ${existingUser.role}, isDeleted: ${existingUser.isDeleted}). ` +
              `Using this user for stops assigned to "${driverName}".`
            );
            return existingUser;
          }

          // If we still can't find the user, return null and we'll handle it below
          return null;
        }
      }
    );

    // Wait for all driver creations to complete
    const newDriversResults = await Promise.all(driverCreationPromises);

    // Filter out null results and add valid drivers to the map
    const newDrivers = newDriversResults.filter((driver): driver is User => driver !== null);

    for (const driver of newDrivers) {
      driverMap.set(driver.username, driver);
    }

    // Find the admin user who is uploading the route
    const adminUser = await tx.user.findUnique({
      where: {
        id: uploadedBy,
        isDeleted: false,
      },
    });

    if (!adminUser) {
      throw new Error(`Admin user with ID ${uploadedBy} not found`);
    }

    // Ensure the user has admin privileges
    if (!["ADMIN", "SUPER_ADMIN"].includes(adminUser.role)) {
      throw new Error(
        `User ${adminUser.username} does not have admin privileges`
      );
    }

    // Check if a route with the same route number AND date already exists
    let route: Route | null = null;

    if (parsedRoute.routeNumber) {
      // Normalize the route date for consistent comparison
      const normalizedRouteDate = new Date(parsedRoute.date);
      normalizedRouteDate.setHours(0, 0, 0, 0);

      const startOfDay = new Date(normalizedRouteDate);
      const endOfDay = new Date(normalizedRouteDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingRoute = await tx.route.findFirst({
        where: {
          routeNumber: parsedRoute.routeNumber,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          isDeleted: false,
        },
      });

      if (existingRoute) {
        console.log(`Existing route found. Action: ${action || 'default'}`);

        if (action === 'create') {
          // Delete the existing route completely and create a fresh one
          console.log(`Deleting existing route ${existingRoute.routeNumber} to create fresh one`);

          // First, get all stops for this route to delete admin notes
          const existingStops = await tx.stop.findMany({
            where: { routeId: existingRoute.id },
            select: { id: true },
          });

          // Delete all admin notes associated with these stops
          if (existingStops.length > 0) {
            await tx.adminNote.deleteMany({
              where: {
                stopId: {
                  in: existingStops.map((stop) => stop.id),
                },
              },
            });
          }

          // Delete all stops for this route
          await tx.stop.deleteMany({
            where: { routeId: existingRoute.id },
          });

          // Delete all safety checks for this route
          await tx.safetyCheck.deleteMany({
            where: { routeId: existingRoute.id },
          });

          // Delete the route itself
          await tx.route.delete({
            where: { id: existingRoute.id },
          });

          console.log(`Deleted existing route ${existingRoute.routeNumber} completely`);
          // Route will be created fresh below with same route number
        } else {
          // Smart update: merge new data with existing route
          console.log(`Performing smart update for route ${existingRoute.routeNumber}`);
          route = await tx.route.update({
            where: { id: existingRoute.id },
            data: {
              date: parsedRoute.date,
              uploadedBy: uploadedBy,
              sourceFile: fileName,
              // Don't change the status if it's already in progress or completed
              status: ["IN_PROGRESS", "COMPLETED"].includes(existingRoute.status)
                ? existingRoute.status
                : "PENDING",
            },
          });

          // Get all existing stops with full data for intelligent merging
          const existingStopsWithData = await tx.stop.findMany({
            where: { routeId: route.id },
            include: {
              customer: true,
            },
          });

          // Create maps for quick lookup
          const existingStopsByCustomer = new Map<string, any>();
          const existingStopsBySequence = new Map<number, any>();

          for (const stop of existingStopsWithData) {
            const customerKey = stop.customerNameFromUpload || stop.customer.name;
            existingStopsByCustomer.set(customerKey, stop);
            existingStopsBySequence.set(stop.sequence, stop);
          }

          // Track which existing stops we've matched
          const matchedStopIds = new Set<string>();

          // Process each new stop for intelligent merging
          const newStopsToProcess: ParsedStop[] = [];

          for (const newStop of parsedRoute.stops) {
            // Try to find existing stop by customer name first
            let existingStop = existingStopsByCustomer.get(newStop.customerName);

            // If not found by customer, try by sequence number
            if (!existingStop) {
              existingStop = existingStopsBySequence.get(newStop.sequence);
            }

            if (existingStop) {
              // Update existing stop with new information
              console.log(`Updating existing stop for ${newStop.customerName} (sequence ${newStop.sequence})`);

              // Preserve existing payment amounts unless they were explicitly changed
              // Only update payment amounts if new values are provided and different from existing
              const shouldUpdatePaymentAmounts =
                (newStop.paymentAmountCash !== undefined && newStop.paymentAmountCash !== (existingStop.paymentAmountCash || 0)) ||
                (newStop.paymentAmountCheck !== undefined && newStop.paymentAmountCheck !== (existingStop.paymentAmountCheck || 0)) ||
                (newStop.paymentAmountCC !== undefined && newStop.paymentAmountCC !== (existingStop.paymentAmountCC || 0));

              const updateData: any = {
                sequence: newStop.sequence,
                customerNameFromUpload: newStop.customerName,
                driverNameFromUpload: newStop.driverName,
                // Update invoice numbers only if they're provided and different
                quickbooksInvoiceNum: newStop.quickbooksInvoiceNum || existingStop.quickbooksInvoiceNum,
                orderNumberWeb: newStop.orderNumberWeb || existingStop.orderNumberWeb,
                initialDriverNotes: newStop.initialDriverNotes || existingStop.initialDriverNotes,
                isCOD: newStop.isCOD,
                paymentFlagCash: newStop.paymentFlagCash,
                paymentFlagCheck: newStop.paymentFlagCheck,
                paymentFlagCC: newStop.paymentFlagCC,
                paymentFlagNotPaid: newStop.paymentFlagNotPaid,
                returnFlagInitial: newStop.returnFlagInitial,
                driverRemarkInitial: newStop.driverRemarkInitial,
                amount: newStop.amount !== undefined ? newStop.amount : existingStop.amount,
              };

              // Only update payment amounts if they were actually changed in the Excel file
              if (shouldUpdatePaymentAmounts) {
                updateData.paymentAmountCash = newStop.paymentAmountCash !== undefined ? newStop.paymentAmountCash : existingStop.paymentAmountCash;
                updateData.paymentAmountCheck = newStop.paymentAmountCheck !== undefined ? newStop.paymentAmountCheck : existingStop.paymentAmountCheck;
                updateData.paymentAmountCC = newStop.paymentAmountCC !== undefined ? newStop.paymentAmountCC : existingStop.paymentAmountCC;
                updateData.totalPaymentAmount = (updateData.paymentAmountCash || 0) +
                                               (updateData.paymentAmountCheck || 0) +
                                               (updateData.paymentAmountCC || 0);
                console.log(`Payment amounts updated for ${newStop.customerName}: Cash=${updateData.paymentAmountCash}, Check=${updateData.paymentAmountCheck}, CC=${updateData.paymentAmountCC}`);
              } else {
                // Preserve existing payment amounts - don't include them in updateData
                console.log(`Preserving existing payment amounts for ${newStop.customerName}`);
              }

              await tx.stop.update({
                where: { id: existingStop.id },
                data: updateData,
              });

              matchedStopIds.add(existingStop.id);

              // Preserve existing invoice data in the map for any new stops
              customerInvoiceMap.set(newStop.customerName, {
                quickbooksInvoiceNum: existingStop.quickbooksInvoiceNum,
                orderNumberWeb: existingStop.orderNumberWeb,
              });
            } else {
              // This is a new stop, add it to the list to be created
              newStopsToProcess.push(newStop);
              console.log(`New stop detected for ${newStop.customerName} (sequence ${newStop.sequence})`);
            }
          }

          // Update parsedRoute.stops to only contain the new stops that need to be created
          parsedRoute.stops = newStopsToProcess;

          isUpdate = true;
          console.log(`Smart update completed for route: ${parsedRoute.routeNumber}`);
          console.log(`- Updated ${matchedStopIds.size} existing stops`);
          console.log(`- Will create ${newStopsToProcess.length} new stops`);
        }
      }
    }

    // If no existing route was found or updated, create a new one
    if (!route) {
      route = await tx.route.create({
        data: {
          routeNumber: parsedRoute.routeNumber,
          date: parsedRoute.date,
          driverId: null, // Routes can have multiple drivers, so we don't set a primary driver
          uploadedBy: uploadedBy,
          sourceFile: fileName,
          status: "PENDING",
        },
      });
    }

    // Performance optimization: Batch process customers
    // First, get all unique customer names (only for new stops if this is an update)
    const customerNamesSet = new Set<string>();
    for (const stop of parsedRoute.stops) {
      customerNamesSet.add(stop.customerName);
    }
    const customerNames = Array.from(customerNamesSet);

    console.log(`Processing ${parsedRoute.stops.length} stops for customer creation/updates`);

    // Batch query existing customers
    const existingCustomers = await tx.customer.findMany({
      where: {
        name: {
          in: customerNames,
        },
        isDeleted: false,
      },
    });

    // Create a map for quick customer lookup
    const customerMap = new Map<string, Customer>();
    for (const customer of existingCustomers) {
      customerMap.set(customer.name, customer);
    }

    // Prepare batch creation for missing customers
    const customersToCreate: {
      name: string;
      address: string;
      groupCode?: string;
      email?: string;
    }[] = [];
    const customersToUpdate: {
      id: string;
      groupCode?: string;
      email?: string;
    }[] = [];

    // Identify customers that need to be created or updated
    for (const customerName of customerNames) {
      const customer = customerMap.get(customerName);

      // Find the first stop with this customer to get the group code and email
      const stopWithCustomer = parsedRoute.stops.find(
        (stop) => stop.customerName === customerName
      );

      if (!customer && stopWithCustomer) {
        // Check if there are any customers with the same name (including deleted ones)
        const allCustomersWithName = await tx.customer.findMany({
          where: {
            name: customerName,
          },
          orderBy: {
            createdAt: 'desc', // Get the most recent one first
          },
        });

        if (allCustomersWithName.length > 0) {
          // Use the most recent customer (likely the manually created one)
          const mostRecentCustomer = allCustomersWithName[0];

          if (mostRecentCustomer.isDeleted) {
            // Restore the deleted customer instead of creating a new one
            await tx.customer.update({
              where: { id: mostRecentCustomer.id },
              data: {
                isDeleted: false,
                groupCode: stopWithCustomer.customerGroupCode || mostRecentCustomer.groupCode,
                email: stopWithCustomer.customerEmail || mostRecentCustomer.email,
              },
            });
            customerMap.set(customerName, mostRecentCustomer);
            console.log(`🔄 Restored deleted customer: ${customerName}`);
          } else {
            // Customer exists and is active, use it
            customerMap.set(customerName, mostRecentCustomer);
            console.log(`✅ Using existing customer: ${customerName}`);
          }
        } else {
          // No customer with this name exists, create new one
          customersToCreate.push({
            name: customerName,
            address: "", // This will need to be updated later
            groupCode: stopWithCustomer.customerGroupCode,
            email: stopWithCustomer.customerEmail,
          });
        }
      } else if (
        customer &&
        stopWithCustomer &&
        ((stopWithCustomer.customerGroupCode && !customer.groupCode) ||
          (stopWithCustomer.customerEmail && !customer.email))
      ) {
        // Need to update this customer's group code or email
        const updateData: { id: string; groupCode?: string; email?: string } = {
          id: customer.id,
        };

        if (stopWithCustomer.customerGroupCode && !customer.groupCode) {
          updateData.groupCode = stopWithCustomer.customerGroupCode;
        }

        if (stopWithCustomer.customerEmail && !customer.email) {
          updateData.email = stopWithCustomer.customerEmail;
        }

        customersToUpdate.push(updateData);
      }
    }

    // Batch create missing customers
    if (customersToCreate.length > 0) {
      const newCustomers = await Promise.all(
        customersToCreate.map((customerData) =>
          tx.customer.create({ data: customerData })
        )
      );

      // Add new customers to the map
      for (const customer of newCustomers) {
        customerMap.set(customer.name, customer);
      }
    }

    // Batch update customers that need group code or email updates
    if (customersToUpdate.length > 0) {
      await Promise.all(
        customersToUpdate.map((update) =>
          tx.customer.update({
            where: { id: update.id },
            data: {
              groupCode: update.groupCode,
              email: update.email,
            },
          })
        )
      );
    }

    // Process each stop (only new stops if this is an update)
    for (const parsedStop of parsedRoute.stops) {
      // Get the customer for this stop
      const customer = customerMap.get(parsedStop.customerName);

      if (!customer) {
        console.warn(`Customer not found for stop: ${parsedStop.customerName}`);
        continue;
      }

      // Check if we have existing invoice data for this customer
      const existingInvoiceData = customerInvoiceMap.get(
        parsedStop.customerName
      );

      // Use existing invoice numbers if available and new ones are not provided
      // Convert undefined to empty string to avoid null values in the database
      const quickbooksInvoiceNum =
        parsedStop.quickbooksInvoiceNum ||
        (existingInvoiceData ? existingInvoiceData.quickbooksInvoiceNum : "") ||
        "";

      const orderNumberWeb =
        parsedStop.orderNumberWeb ||
        (existingInvoiceData ? existingInvoiceData.orderNumberWeb : "") ||
        "";

      // If the customer has an email in the Excel file, update it in the database
      if (
        parsedStop.customerEmail &&
        customer.email !== parsedStop.customerEmail
      ) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { email: parsedStop.customerEmail },
        });

        console.log(
          `Updated email for customer ${parsedStop.customerName}: ${parsedStop.customerEmail}`
        );
      }

      // Enhanced logging to track invoice number assignment
      console.log(`=== INVOICE NUMBER TRACKING for ${parsedStop.customerName} ===`);
      console.log(`Parsed from Excel:`, {
        quickbooksInvoiceNum: parsedStop.quickbooksInvoiceNum,
        quickbooksInvoiceNum_type: typeof parsedStop.quickbooksInvoiceNum,
        quickbooksInvoiceNum_isEmpty: !parsedStop.quickbooksInvoiceNum || parsedStop.quickbooksInvoiceNum === "",
        orderNumberWeb: parsedStop.orderNumberWeb,
        orderNumberWeb_type: typeof parsedStop.orderNumberWeb,
        orderNumberWeb_isEmpty: !parsedStop.orderNumberWeb || parsedStop.orderNumberWeb === "",
      });
      console.log(`Final values being saved to database:`, {
        finalInvoiceNum: quickbooksInvoiceNum,
        finalOrderNum: orderNumberWeb,
        isUpdate,
        existingInvoiceData: existingInvoiceData,
      });
      console.log(`=== END INVOICE NUMBER TRACKING ===`);

      // Log the data being used to create the stop
      const stopData = {
        routeId: route.id,
        customerId: customer.id,
        sequence: parsedStop.sequence,
        address: customer.address || "",
        customerNameFromUpload: parsedStop.customerName,
        orderNumberWeb: orderNumberWeb,
        quickbooksInvoiceNum: quickbooksInvoiceNum,
        initialDriverNotes: parsedStop.initialDriverNotes,
        isCOD: parsedStop.isCOD,
        paymentFlagCash: parsedStop.paymentFlagCash,
        paymentFlagCheck: parsedStop.paymentFlagCheck,
        paymentFlagCC: parsedStop.paymentFlagCC,
        paymentFlagNotPaid: parsedStop.paymentFlagNotPaid,
        returnFlagInitial: parsedStop.returnFlagInitial,
        driverRemarkInitial: parsedStop.driverRemarkInitial,
        amount: parsedStop.amount,
        // Payment amounts from Excel columns AK, AL, AM
        paymentAmountCash: parsedStop.paymentAmountCash || null,
        paymentAmountCheck: parsedStop.paymentAmountCheck || null,
        paymentAmountCC: parsedStop.paymentAmountCC || null,
        totalPaymentAmount: parsedStop.totalPaymentAmount || null,
        status: "PENDING" as const,
        // Store the driver name for reference
        driverNameFromUpload: parsedStop.driverName,
      };

      console.log(`Creating stop for ${parsedStop.customerName} with data:`, {
        quickbooksInvoiceNum: stopData.quickbooksInvoiceNum,
        orderNumberWeb: stopData.orderNumberWeb,
      });

      // Create the stop
      const createdStop = await tx.stop.create({
        data: stopData,
      });

      // If admin notes are provided, create an admin note for this stop
      if (parsedStop.adminNotes && parsedStop.adminNotes.trim() !== "") {
        await tx.adminNote.create({
          data: {
            stopId: createdStop.id,
            adminId: adminUser.id, // Use the admin who uploaded the route as the creator of the note
            note: parsedStop.adminNotes,
            readByDriver: false,
          },
        });
      }
    }

    return {
      route,
      isUpdate,
    };
  });
}
