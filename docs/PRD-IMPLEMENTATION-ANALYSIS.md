# B&R Driver App - PRD Implementation Analysis
## Senior Software Engineer Assessment

**Date:** November 20, 2025  
**Analyst:** Senior Software Engineer  
**Project:** Driver Portal & Operations Enhancement  
**Timeline:** 3 Months (~2.5 Weeks per Milestone)

---

## Executive Summary

This document provides an in-depth technical analysis of implementing the Product Requirements Document (PRD) for the B&R Driver App. The analysis covers all five milestones, identifying affected files, required database changes, new components, and implementation strategies.

### Current Application State

**Tech Stack:**
- **Frontend:** Next.js 15.3.1 with TypeScript, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes with custom Node.js server
- **Database:** PostgreSQL with Prisma ORM 6.7.0
- **Authentication:** JWT with Argon2 password hashing
- **Real-time:** Socket.io 4.8.1
- **Email:** Nodemailer with Brevo SMTP
- **PDF Generation:** pdf-lib 1.17.1, Puppeteer 21.11.0
- **File Processing:** xlsx 0.18.5, Sharp 0.34.3
- **Deployment:** PM2 on Ubuntu 24.04 VPS with Nginx

**Current Features:**
- ✅ Role-based authentication (Admin, Super Admin, Driver)
- ✅ Route management with Excel upload
- ✅ Stop tracking with status workflow
- ✅ Document management (customer & stop-specific)
- ✅ Return processing with product catalog
- ✅ Payment tracking (multiple methods)
- ✅ PDF generation with image links
- ✅ Email notifications (Brevo SMTP)
- ✅ Safety check system
- ✅ Real-time updates via WebSocket
- ✅ Google Maps integration (basic)
- ✅ Admin notes system
- ✅ Customer management
- ✅ Product management

---

## Milestone 1: Foundational Backend & UI Updates

### Overview
Database schema updates and admin UI enhancements for new fields.

### 1.1 Customer Payment Terms (FR-3.1)

**Current State:**
- Customer model has `preferences` field (String?)
- No dedicated payment terms field
- Global COD setting mentioned in PRD

**Required Changes:**

#### Database Schema Changes
**File:** `prisma/schema.prisma`
```prisma
model Customer {
  // ... existing fields
  paymentTerms String? // New field: 'COD', 'Net 30', 'Prepaid', etc.
  deliveryInstructions String? // New field for FR-3.2
  // ... rest of model
}
```

**Migration Command:**
```bash
npx prisma migrate dev --name add_customer_payment_terms_and_delivery_instructions
```

#### Backend API Changes
**Files to Modify:**
1. `src/app/api/admin/customers/route.ts` (Lines 138-231)
   - Add `paymentTerms` and `deliveryInstructions` to POST handler
   - Update validation logic

2. `src/app/api/admin/customers/[id]/route.ts` (Lines 183-206)
   - Add fields to PATCH handler
   - Update response serialization

#### Frontend Changes
**Files to Modify:**
1. `src/app/admin/customers/[id]/edit/page.tsx` (Lines 27-83)
   - Add payment terms dropdown field
   - Add delivery instructions textarea
   - Update form state management

2. `src/app/admin/customers/[id]/page.tsx` (Customer details view)
   - Display payment terms badge
   - Display delivery instructions section

3. `src/app/admin/customers/page.tsx` (Customer list)
   - Add payment terms column (optional)

**New Component:**
`src/components/admin/PaymentTermsSelector.tsx`
```typescript
// Dropdown component with predefined payment terms
// Options: COD, Net 30, Net 60, Prepaid, Credit Account
```

### 1.2 Vehicle Type Specification (FR-6.1)

**Current State:**
- No vehicle management system exists
- Drivers are assigned to routes but not vehicles
- Safety checks reference truck numbers as strings

**Required Changes:**

#### Database Schema Changes
**File:** `prisma/schema.prisma`
```prisma
model Vehicle {
  id String @id @default(uuid())
  vehicleNumber String @unique // Truck #
  vehicleType VehicleType // GASOLINE_VAN or DIESEL_TRUCK
  fuelType FuelType // GASOLINE or DIESEL
  licensePlate String?
  make String?
  model String?
  year Int?
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean @default(false)
  
  // Relations
  assignments VehicleAssignment[]
  
  @@index([vehicleNumber])
  @@index([isActive])
  @@index([isDeleted])
  @@map("vehicles")
}

model VehicleAssignment {
  id String @id @default(uuid())
  vehicleId String
  vehicle Vehicle @relation(fields: [vehicleId], references: [id])
  driverId String
  driver User @relation("DriverVehicleAssignments", fields: [driverId], references: [id])
  routeId String?
  route Route? @relation(fields: [routeId], references: [id])
  assignedAt DateTime @default(now())
  unassignedAt DateTime?
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean @default(false)
  
  @@index([vehicleId])
  @@index([driverId])
  @@index([routeId])
  @@index([isActive])
  @@index([isDeleted])
  @@map("vehicle_assignments")
}

enum VehicleType {
  GASOLINE_VAN
  DIESEL_TRUCK
}

enum FuelType {
  GASOLINE
  DIESEL
}
```

**Update User Model:**
```prisma
model User {
  // ... existing fields
  vehicleAssignments VehicleAssignment[] @relation("DriverVehicleAssignments")
  // ... rest of model
}
```

**Update Route Model:**
```prisma
model Route {
  // ... existing fields
  vehicleAssignments VehicleAssignment[]
  // ... rest of model
}
```

#### Backend API Changes
**New Files to Create:**
1. `src/app/api/admin/vehicles/route.ts`
   - GET: List all vehicles with pagination
   - POST: Create new vehicle

2. `src/app/api/admin/vehicles/[id]/route.ts`
   - GET: Get vehicle details
   - PATCH: Update vehicle
   - DELETE: Soft delete vehicle

3. `src/app/api/admin/vehicles/[id]/assign/route.ts`
   - POST: Assign vehicle to driver/route

4. `src/app/api/admin/vehicles/[id]/unassign/route.ts`
   - POST: Unassign vehicle from driver

#### Frontend Changes
**New Pages to Create:**
1. `src/app/admin/vehicles/page.tsx`
   - Vehicle list with CRUD operations
   - Filter by type, status
   - Search by vehicle number

2. `src/app/admin/vehicles/new/page.tsx`
   - Create new vehicle form

3. `src/app/admin/vehicles/[id]/page.tsx`
   - Vehicle details view
   - Assignment history
   - Current assignment status

4. `src/app/admin/vehicles/[id]/edit/page.tsx`
   - Edit vehicle form

**New Components:**
1. `src/components/admin/VehicleSelector.tsx`
   - Dropdown for vehicle selection
   - Shows available vehicles only

2. `src/components/admin/VehicleAssignmentCard.tsx`
   - Display current vehicle assignment
   - Quick assign/unassign actions

### 1.3 Document Categories (FR-1.3)

**Current State:**
- Document model has `type` field with enum: INVOICE, CREDIT_MEMO, DELIVERY_RECEIPT, RETURN_FORM, OTHER
- No specific categories for the 5 required types

**Required Changes:**

#### Database Schema Changes
**File:** `prisma/schema.prisma`
```prisma
enum DocumentType {
  CUSTOMER_INVOICE
  VENDOR_BILL_WORK_ORDER
  GASOLINE_DIESEL_EXPENSE
  DRIVER_WAREHOUSE_HOURS
  SAFETY_DECLARATION
  OTHER
}
```

**Migration:** Update existing documents to new categories

#### Backend API Changes
**Files to Modify:**
1. `src/app/api/admin/documents/route.ts` (Lines 142-196)
   - Update type validation
   - Add category-specific handling

#### Frontend Changes
**Files to Modify:**
1. `src/app/admin/document-management/page.tsx` (Lines 344-424)
   - Update category dropdown
   - Add category-specific validation

2. `src/app/admin/documents/page.tsx` (Lines 114-171)
   - Update type selector

**New Component:**
`src/components/admin/DocumentCategoryBadge.tsx`
```typescript
// Visual badge for document categories with color coding
```

### 1.4 Conditional Fuel Instructions (FR-6.2)

**Current State:**
- No fuel instruction system exists
- Safety checks have fuel-related fields but no instructions

**Required Changes:**

#### Database Schema Changes
**File:** `prisma/schema.prisma`
```prisma
model Vehicle {
  // ... existing fields
  fuelInstructions String? // Specific fueling instructions
  fuelCardNumber String? // Fuel card number
  fuelCapKeyNumber String? // Key number for fuel cap
  // ... rest of model
}
```

#### Backend API Changes
**Files to Modify:**
1. `src/app/api/driver/vehicles/assigned/route.ts` (NEW)
   - GET: Get currently assigned vehicle with fuel instructions

#### Frontend Changes
**Files to Modify:**
1. `src/app/driver/page.tsx` (Driver dashboard)
   - Display assigned vehicle info
   - Show fuel instructions prominently

**New Component:**
`src/components/driver/FuelInstructionsCard.tsx`
```typescript
// Display fuel instructions based on vehicle type
// Show fuel card info, key numbers, etc.
```

---

## Milestone 2: Document Management & Security Implementation

### Overview
Enhanced document management with search, categorization, and security features.

### 2.1 Document Search Functionality (FR-1.1)

**Current State:**
- Document management exists but no search functionality
- Documents displayed in simple list

**Required Changes:**

#### Backend API Changes
**Files to Modify:**
1. `src/app/api/admin/documents/route.ts` (Lines 1-100)
   - Add search query parameter support
   - Implement full-text search on title, description, fileName
   - Add category filter
   - Add date range filter

**Example Implementation:**
```typescript
// Add to GET handler
const searchQuery = url.searchParams.get('search');
const category = url.searchParams.get('category');
const dateFrom = url.searchParams.get('dateFrom');
const dateTo = url.searchParams.get('dateTo');

const documents = await prisma.document.findMany({
  where: {
    isDeleted: false,
    ...(searchQuery && {
      OR: [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { fileName: { contains: searchQuery, mode: 'insensitive' } },
      ],
    }),
    ...(category && { type: category }),
    ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
    ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
  },
  // ... rest of query
});
```

#### Frontend Changes
**Files to Modify:**
1. `src/app/admin/document-management/page.tsx`
   - Add search bar component
   - Add category filter dropdown
   - Add date range picker
   - Implement debounced search

**New Components:**
1. `src/components/admin/DocumentSearchBar.tsx`
   - Search input with icon
   - Real-time search with debounce
   - Clear button

2. `src/components/admin/DocumentFilters.tsx`
   - Category filter
   - Date range filter
   - Sort options

### 2.2 PDF Print Button UI Fix (FR-1.2)

**Current State:**
- PDF viewer exists but print button positioning issues mentioned

**Required Changes:**

#### Frontend Changes
**Files to Modify:**
1. `src/components/admin/DocumentPreview.tsx` (Lines 120-258)
   - Fix print button styling
   - Ensure full-width on mobile
   - Add responsive breakpoints

**CSS Changes:**
```typescript
// Update button classes
className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
```

### 2.3 Daily Safety & Declaration Page (FR-1.5)

**Current State:**
- Safety check system exists
- No automatic document attachment

**Required Changes:**

#### Database Schema Changes
**File:** `prisma/schema.prisma`
```prisma
model SystemDocument {
  id String @id @default(uuid())
  documentType SystemDocumentType
  filePath String
  fileName String
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean @default(false)

  @@map("system_documents")
}

enum SystemDocumentType {
  DAILY_SAFETY_DECLARATION
  SAFETY_INSTRUCTIONS
  COMPANY_POLICY
}
```

#### Backend API Changes
**New Files to Create:**
1. `src/app/api/admin/system-documents/route.ts`
   - GET: List system documents
   - POST: Upload system document

2. `src/app/api/driver/daily-documents/route.ts`
   - GET: Get daily required documents (safety declaration, etc.)

**Files to Modify:**
1. `src/app/api/driver/routes/[id]/assigned-stops/route.ts`
   - Include system documents in response

#### Frontend Changes
**Files to Modify:**
1. `src/app/driver/page.tsx` (Driver dashboard)
   - Show daily safety declaration link
   - Highlight if not acknowledged

**New Component:**
`src/components/driver/DailySafetyDeclaration.tsx`
```typescript
// Display safety declaration PDF
// Require acknowledgment before showing routes
```

### 2.4 Interactive Safety Instructions PDF (FR-1.6)

**Current State:**
- PDF viewing exists
- No special handling for tel: links

**Required Changes:**

#### Frontend Changes
**Files to Modify:**
1. `src/components/admin/DocumentPreview.tsx`
   - Ensure PDF viewer supports interactive links
   - Test tel: link functionality

**Note:** Most modern PDF viewers (including browser native viewers) support tel: links by default. May just need testing.

### 2.5 Password Confirmation for Deletions (FR-5.1)

**Current State:**
- Delete confirmations exist but no password re-entry
- Examples in: user management, customer management, product management

**Required Changes:**

#### Backend API Changes
**New Middleware:**
`src/lib/passwordConfirmation.ts`
```typescript
export async function verifyPasswordForDeletion(
  userId: string,
  password: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) return false;

  return await argon2.verify(user.password, password);
}
```

**Files to Modify:**
1. `src/app/api/admin/users/[id]/route.ts` (DELETE handler)
   - Add password verification before deletion
   - Return 403 if password incorrect

2. `src/app/api/admin/customers/[id]/route.ts` (DELETE handler)
   - Add password verification

3. `src/app/api/admin/products/[id]/route.ts` (DELETE handler)
   - Add password verification

4. `src/app/api/admin/routes/[id]/route.ts` (DELETE handler)
   - Add password verification

5. `src/app/api/admin/documents/[id]/route.ts` (DELETE handler)
   - Add password verification

6. `src/app/api/admin/vehicles/[id]/route.ts` (DELETE handler)
   - Add password verification

#### Frontend Changes
**New Component:**
`src/components/admin/PasswordConfirmationModal.tsx`
```typescript
interface PasswordConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  itemName: string;
  itemType: string;
}

// Modal with password input
// Shows error if password incorrect
// Handles loading state
```

**Files to Modify:**
1. `src/app/admin/user-management/page.tsx` (Lines 172-205)
   - Replace simple confirmation with password modal
   - Send password with delete request

2. `src/app/admin/customers/[id]/page.tsx` (Lines 1014-1042)
   - Add password confirmation modal

3. `src/app/admin/products/[id]/page.tsx` (Lines 194-220)
   - Add password confirmation modal

4. `src/app/admin/routes/[id]/page.tsx`
   - Add password confirmation for route deletion

5. `src/app/admin/document-management/page.tsx`
   - Add password confirmation for document deletion

6. `src/app/admin/vehicles/[id]/page.tsx`
   - Add password confirmation for vehicle deletion

---

## Milestone 3: Attendance System Integration & Access Control

### Overview
Integration with existing standalone attendance application for time tracking, with strict access control to ensure drivers can only access routes when clocked in.

### 🎯 Key Decision: API Integration vs Building From Scratch

**Decision:** Integrate with existing attendance application via REST API instead of building time tracking from scratch.

**Rationale:**
1. **Separation of Concerns:** Attendance app is a dedicated, well-rounded system for time tracking
2. **No Data Duplication:** Single source of truth for all time-related data
3. **Reduced Complexity:** B&R Driver App focuses on delivery operations only
4. **Faster Implementation:** API integration is faster than building full time tracking system
5. **Easier Maintenance:** Time tracking logic centralized in one application
6. **Flexibility:** Can swap attendance systems without major B&R Driver App refactoring

**What This Means:**
- ❌ **NOT Building:** TimeEntry models, BreakEntry models, barcode scanner, break tracking UI, overtime monitoring, SMS notifications
- ✅ **Building:** API integration service, access control middleware, clock-in status display, route access guards, error handling

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    B&R Driver App                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Driver Interface                                    │  │
│  │  - View clock-in status                              │  │
│  │  - Trigger clock in/out                              │  │
│  │  - Access routes (if clocked in)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Attendance Integration Service                      │  │
│  │  - API client with retry logic                       │  │
│  │  - 5-minute cache for performance                    │  │
│  │  - Fallback mode for API failures                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           │ REST API
                           │ (HTTPS)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Attendance Application                         │
│                                                             │
│  - Clock in/out (barcode + manual)                         │
│  - Break & lunch tracking                                  │
│  - Overtime monitoring                                     │
│  - SMS notifications                                       │
│  - Time calculations                                       │
│  - Compliance tracking                                     │
│  - Reporting                                               │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoints Required from Attendance App:**
1. `GET /shifts/current/:driverId` - Get current shift status
2. `POST /shifts/clock-in` - Clock in a driver
3. `POST /shifts/clock-out` - Clock out a driver

**Data Flow Example:**
1. Driver opens B&R Driver App
2. App calls attendance API to check clock-in status
3. If not clocked in: Show clock-in prompt, block route access
4. If clocked in: Show status badge, allow route access
5. Driver clicks "Clock In" button
6. App calls attendance API to clock in
7. Attendance app records time entry
8. App refreshes status and allows route access

### 3.1 Attendance Application Integration Architecture (FR-2.1, FR-2.2, FR-2.3)

**Current State:**
- A separate, fully functional attendance application exists
- Attendance app handles: clock in/out, breaks, lunch tracking, overtime monitoring
- B&R Driver App has no integration with attendance system
- No access control based on clock-in status

**Integration Strategy:**
- B&R Driver App will integrate via REST API with the attendance application
- Drivers can view clock-in status and trigger clock in/out from the delivery app
- All time tracking data remains in the attendance app database
- B&R Driver App enforces route access based on active shift status

**Required Changes:**

#### Database Schema Changes (Minimal)
**File:** `prisma/schema.prisma`
```prisma
model User {
  // ... existing fields
  attendanceAppUserId String? // Link to attendance app user ID
  lastClockInStatusCheck DateTime? // Cache timestamp
  cachedClockInStatus Boolean @default(false) // Cached status
  // ... rest of model
}
```

**Note:** No TimeEntry or BreakEntry models needed - all time data lives in attendance app.

### 3.2 Attendance API Integration Service (FR-2.1)

**Current State:**
- No API integration service exists

**Required Changes:**

#### Environment Variables
Add to `.env`:
```
# Attendance App Integration
ATTENDANCE_API_BASE_URL=https://attendance-app-url.com/api
ATTENDANCE_API_KEY=your_api_key_here
ATTENDANCE_API_TIMEOUT=5000 # 5 seconds
ATTENDANCE_STATUS_CACHE_DURATION=300000 # 5 minutes in ms

# Fallback behavior when attendance API is down
ATTENDANCE_API_FALLBACK_MODE=strict # 'strict' or 'permissive'
# strict: Block all route access if API is down
# permissive: Allow access with warning if API is down
```

#### Backend API Integration Service
**New Service File:**
`src/services/attendanceIntegration.ts`
```typescript
import axios, { AxiosInstance } from 'axios';

interface AttendanceStatus {
  isActive: boolean;
  shiftId: string | null;
  clockInTime: Date | null;
  clockOutTime: Date | null;
  totalHoursWorked: number;
  isOnBreak: boolean;
  breakType: 'PAID_BREAK' | 'UNPAID_LUNCH' | null;
  overtimeStatus: {
    isOvertime: boolean;
    hoursWorked: number;
    threshold: number;
  };
}

interface ClockInResponse {
  success: boolean;
  shiftId: string;
  clockInTime: Date;
  message: string;
}

interface ClockOutResponse {
  success: boolean;
  clockOutTime: Date;
  totalHoursWorked: number;
  message: string;
}

class AttendanceAPIService {
  private client: AxiosInstance;
  private cache: Map<string, { status: AttendanceStatus; timestamp: number }>;
  private cacheDuration: number;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.ATTENDANCE_API_BASE_URL,
      timeout: parseInt(process.env.ATTENDANCE_API_TIMEOUT || '5000'),
      headers: {
        'Authorization': `Bearer ${process.env.ATTENDANCE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    this.cache = new Map();
    this.cacheDuration = parseInt(process.env.ATTENDANCE_STATUS_CACHE_DURATION || '300000');
  }

  /**
   * Get current attendance status for a driver
   * Uses cache to reduce API calls
   */
  async getDriverStatus(driverId: string, forceRefresh = false): Promise<AttendanceStatus> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.cache.get(driverId);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.status;
      }
    }

    try {
      const response = await this.client.get(`/shifts/current/${driverId}`);
      const status: AttendanceStatus = response.data;

      // Update cache
      this.cache.set(driverId, {
        status,
        timestamp: Date.now(),
      });

      return status;
    } catch (error) {
      console.error('Attendance API error:', error);

      // Return cached data if available, even if expired
      const cached = this.cache.get(driverId);
      if (cached) {
        console.warn('Using expired cache due to API error');
        return cached.status;
      }

      // No cache available - throw error
      throw new Error('Unable to fetch attendance status');
    }
  }

  /**
   * Trigger clock in from B&R Driver App
   */
  async clockIn(driverId: string, method: 'BARCODE' | 'MANUAL', barcode?: string): Promise<ClockInResponse> {
    try {
      const response = await this.client.post('/shifts/clock-in', {
        driverId,
        method,
        barcode,
        source: 'BR_DRIVER_APP',
      });

      // Invalidate cache
      this.cache.delete(driverId);

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Clock in failed');
    }
  }

  /**
   * Trigger clock out from B&R Driver App
   */
  async clockOut(driverId: string): Promise<ClockOutResponse> {
    try {
      const response = await this.client.post('/shifts/clock-out', {
        driverId,
        source: 'BR_DRIVER_APP',
      });

      // Invalidate cache
      this.cache.delete(driverId);

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Clock out failed');
    }
  }

  /**
   * Check if driver has an active shift
   */
  async hasActiveShift(driverId: string): Promise<boolean> {
    try {
      const status = await this.getDriverStatus(driverId);
      return status.isActive && status.clockOutTime === null;
    } catch (error) {
      // Handle based on fallback mode
      if (process.env.ATTENDANCE_API_FALLBACK_MODE === 'permissive') {
        console.warn('Attendance API unavailable - allowing access (permissive mode)');
        return true;
      }
      return false;
    }
  }

  /**
   * Clear cache for a specific driver
   */
  clearCache(driverId: string): void {
    this.cache.delete(driverId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}

export const attendanceAPI = new AttendanceAPIService();
```

#### Backend Middleware for Access Control
**New Middleware File:**
`src/middleware/attendanceCheck.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { attendanceAPI } from '@/services/attendanceIntegration';
import { verifyToken } from '@/lib/auth';

export async function requireActiveShift(request: NextRequest) {
  try {
    // Get user from token
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check attendance status
    const hasActiveShift = await attendanceAPI.hasActiveShift(decoded.userId);

    if (!hasActiveShift) {
      return NextResponse.json(
        {
          error: 'NO_ACTIVE_SHIFT',
          message: 'You must clock in before accessing routes. Please clock in to continue.',
          requiresClockIn: true,
        },
        { status: 403 }
      );
    }

    // Allow request to proceed
    return null;
  } catch (error: any) {
    console.error('Attendance check error:', error);

    // Check fallback mode
    if (process.env.ATTENDANCE_API_FALLBACK_MODE === 'permissive') {
      console.warn('Attendance check failed - allowing access (permissive mode)');
      return null; // Allow access
    }

    return NextResponse.json(
      {
        error: 'ATTENDANCE_CHECK_FAILED',
        message: 'Unable to verify clock-in status. Please try again or contact support.',
        isSystemError: true,
      },
      { status: 503 }
    );
  }
}
```

### 3.3 Route Access Control Implementation (Critical Edge Case)

**Current State:**
- Drivers can access routes without any clock-in verification

**Required Changes:**

#### Backend API Changes
**Files to Modify:**

1. `src/app/api/driver/routes/route.ts` (Get assigned routes)
   - Add attendance check middleware
   - Return clock-in requirement if not clocked in

```typescript
import { requireActiveShift } from '@/middleware/attendanceCheck';

export async function GET(request: NextRequest) {
  // Check attendance status first
  const attendanceCheck = await requireActiveShift(request);
  if (attendanceCheck) return attendanceCheck;

  // Proceed with route fetching...
}
```

2. `src/app/api/driver/stops/route.ts` (Get stops)
   - Add attendance check middleware

3. `src/app/api/driver/stops/[id]/route.ts` (Get/update specific stop)
   - Add attendance check middleware

4. `src/app/api/driver/stops/[id]/complete/route.ts` (Complete stop)
   - Add attendance check middleware

5. `src/app/api/driver/stops/[id]/payment/route.ts` (Record payment)
   - Add attendance check middleware

6. `src/app/api/driver/stops/[id]/returns/route.ts` (Record returns)
   - Add attendance check middleware

**New API Endpoints:**

1. `src/app/api/driver/attendance/status/route.ts`
   - GET: Get current attendance status
   - Returns clock-in status, hours worked, break status

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { attendanceAPI } from '@/services/attendanceIntegration';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    const status = await attendanceAPI.getDriverStatus(decoded.userId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        isSystemError: true,
      },
      { status: 503 }
    );
  }
}
```

2. `src/app/api/driver/attendance/clock-in/route.ts`
   - POST: Trigger clock in via attendance app

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { attendanceAPI } from '@/services/attendanceIntegration';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    const body = await request.json();
    const { method, barcode } = body;

    const result = await attendanceAPI.clockIn(decoded.userId, method, barcode);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}
```

3. `src/app/api/driver/attendance/clock-out/route.ts`
   - POST: Trigger clock out via attendance app

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { attendanceAPI } from '@/services/attendanceIntegration';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    const result = await attendanceAPI.clockOut(decoded.userId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}
```

### 3.4 Frontend Integration & User Experience

**Current State:**
- Driver dashboard shows routes without clock-in check
- No clock-in status display

**Required Changes:**

#### Frontend Changes
**Files to Modify:**

1. `src/app/driver/page.tsx` (Driver dashboard)
   - Add clock-in status widget at top
   - Show warning if not clocked in
   - Disable route access if not clocked in

**New Components:**

1. `src/components/driver/AttendanceStatusCard.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface AttendanceStatus {
  isActive: boolean;
  clockInTime: Date | null;
  totalHoursWorked: number;
  isOnBreak: boolean;
  breakType: string | null;
}

export default function AttendanceStatusCard() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStatus, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/driver/attendance/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      setStatus(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-24 rounded-lg"></div>;
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-yellow-600" size={20} />
          <p className="text-yellow-800">Unable to verify clock-in status</p>
        </div>
      </div>
    );
  }

  if (!status?.isActive) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <div>
              <p className="font-semibold text-red-800">Not Clocked In</p>
              <p className="text-sm text-red-600">You must clock in to access routes</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/driver/clock-in'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Clock In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-green-600" size={20} />
          <div>
            <p className="font-semibold text-green-800">Clocked In</p>
            <p className="text-sm text-green-600">
              {status.totalHoursWorked.toFixed(1)} hours worked
              {status.isOnBreak && ` • On ${status.breakType}`}
            </p>
          </div>
        </div>
        <Clock className="text-green-600" size={24} />
      </div>
    </div>
  );
}
```

2. `src/components/driver/ClockInPromptModal.tsx`
```typescript
'use client';

import { AlertCircle } from 'lucide-react';

interface ClockInPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClockIn: () => void;
}

export default function ClockInPromptModal({
  isOpen,
  onClose,
  onClockIn,
}: ClockInPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="text-red-600" size={32} />
          <h2 className="text-xl font-bold text-gray-900">Clock In Required</h2>
        </div>

        <p className="text-gray-700 mb-6">
          You must clock in before accessing your routes. This ensures accurate time tracking
          and compliance with labor regulations.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClockIn}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Go to Clock In
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

3. `src/components/driver/RouteAccessGuard.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ClockInPromptModal from './ClockInPromptModal';

interface RouteAccessGuardProps {
  children: React.ReactNode;
}

export default function RouteAccessGuard({ children }: RouteAccessGuardProps) {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const response = await fetch('/api/driver/attendance/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        // API error - check fallback mode
        if (response.status === 503) {
          const data = await response.json();
          if (data.isSystemError) {
            // System error - show warning but allow access if permissive
            console.warn('Attendance system unavailable');
            setHasAccess(true);
            return;
          }
        }
        throw new Error('Failed to check access');
      }

      const data = await response.json();
      const isActive = data.data.isActive && data.data.clockOutTime === null;

      setHasAccess(isActive);

      if (!isActive) {
        setShowPrompt(true);
      }
    } catch (error) {
      console.error('Access check error:', error);
      setHasAccess(false);
      setShowPrompt(true);
    }
  };

  const handleClockIn = () => {
    router.push('/driver/clock-in');
  };

  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
            <p className="text-gray-600 mb-6">Please clock in to access your routes</p>
            <button
              onClick={handleClockIn}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Clock In
            </button>
          </div>
        </div>
        <ClockInPromptModal
          isOpen={showPrompt}
          onClose={() => setShowPrompt(false)}
          onClockIn={handleClockIn}
        />
      </>
    );
  }

  return <>{children}</>;
}
```

**New Pages:**

1. `src/app/driver/clock-in/page.tsx`
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ClockInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClockIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/driver/attendance/clock-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'MANUAL',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Clock in failed');
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/driver');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <CheckCircle className="text-green-600 mx-auto mb-4" size={64} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Clocked In Successfully!</h1>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <Clock className="text-blue-600 mx-auto mb-4" size={64} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Clock In</h1>
          <p className="text-gray-600">Start your shift to access routes</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-red-600" size={20} />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleClockIn}
          disabled={loading}
          className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Clocking In...' : 'Clock In Now'}
        </button>

        <p className="text-sm text-gray-500 text-center mt-4">
          Note: This will record your clock-in time in the attendance system
        </p>
      </div>
    </div>
  );
}
```

### 3.5 Edge Cases & Error Handling

**Critical Edge Cases to Handle:**

#### Edge Case 1: Driver Clocks Out Mid-Route
**Scenario:** Driver clocks out while still having incomplete stops

**Solution:**
1. **Prevention Approach (Recommended):**
   - Before allowing clock out, check for incomplete stops
   - Show warning modal: "You have X incomplete stops. Are you sure you want to clock out?"
   - Require confirmation

2. **Implementation:**
   - Add check in attendance app before clock out
   - B&R Driver App sends incomplete stop count to attendance app
   - Attendance app blocks clock out or requires override

**Files to Modify:**
- `src/app/api/driver/attendance/clock-out/route.ts`
  - Check for incomplete stops before allowing clock out
  - Return warning if stops are incomplete

```typescript
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyToken(token);

    // Check for incomplete stops
    const incompleteStops = await prisma.stop.count({
      where: {
        route: {
          driverId: decoded.userId,
          date: {
            gte: getTodayStartUTC(),
            lte: getTodayEndUTC(),
          },
        },
        status: {
          not: 'COMPLETED',
        },
      },
    });

    if (incompleteStops > 0) {
      return NextResponse.json({
        success: false,
        error: 'INCOMPLETE_STOPS',
        message: `You have ${incompleteStops} incomplete stops. Please complete all stops before clocking out.`,
        incompleteStopsCount: incompleteStops,
        requiresConfirmation: true,
      }, { status: 400 });
    }

    // Proceed with clock out
    const result = await attendanceAPI.clockOut(decoded.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
```

#### Edge Case 2: Attendance API is Down/Unreachable
**Scenario:** Attendance app is offline or experiencing issues

**Solution:**
1. **Fallback Modes:**
   - **Strict Mode (Production):** Block all route access, show error message
   - **Permissive Mode (Development/Emergency):** Allow access with warning banner

2. **Implementation:**
   - Environment variable: `ATTENDANCE_API_FALLBACK_MODE`
   - Cache last known status for 5 minutes
   - Show system status banner when API is down

**New Component:**
`src/components/driver/SystemStatusBanner.tsx`
```typescript
'use client';

import { AlertTriangle } from 'lucide-react';

interface SystemStatusBannerProps {
  isAttendanceAPIDown: boolean;
  fallbackMode: 'strict' | 'permissive';
}

export default function SystemStatusBanner({
  isAttendanceAPIDown,
  fallbackMode,
}: SystemStatusBannerProps) {
  if (!isAttendanceAPIDown) return null;

  if (fallbackMode === 'strict') {
    return (
      <div className="bg-red-600 text-white px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} />
          <p className="font-medium">
            Attendance system is currently unavailable. Route access is restricted.
            Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-600 text-white px-4 py-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={20} />
        <p className="font-medium">
          Attendance system is currently unavailable. Operating in emergency mode.
          Your time may need to be manually recorded.
        </p>
      </div>
    </div>
  );
}
```

#### Edge Case 3: Driver's Shift Has Ended But Still Clocked In
**Scenario:** Driver's scheduled shift ended but they forgot to clock out

**Solution:**
1. **Auto-Clock Out (Optional):**
   - Attendance app can auto-clock out after shift end time + grace period
   - B&R Driver App checks if shift is still valid

2. **Implementation:**
   - Add `shiftEndTime` to AttendanceStatus interface
   - Show warning if current time > shift end time
   - Prompt driver to clock out

**Files to Modify:**
- `src/components/driver/AttendanceStatusCard.tsx`
  - Check if shift has ended
  - Show warning banner

```typescript
const isShiftEnded = status.shiftEndTime && new Date() > new Date(status.shiftEndTime);

if (isShiftEnded) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-yellow-600" size={20} />
          <div>
            <p className="font-semibold text-yellow-800">Shift Ended</p>
            <p className="text-sm text-yellow-600">
              Your scheduled shift has ended. Please clock out.
            </p>
          </div>
        </div>
        <button
          onClick={handleClockOut}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
        >
          Clock Out
        </button>
      </div>
    </div>
  );
}
```

#### Edge Case 4: Cache Staleness
**Scenario:** Cached clock-in status is outdated (driver clocked out from attendance app directly)

**Solution:**
1. **Cache Invalidation Strategy:**
   - Cache duration: 5 minutes
   - Force refresh on critical actions (accessing routes, completing stops)
   - Manual refresh button in UI

2. **Implementation:**
   - Add refresh button to AttendanceStatusCard
   - Force refresh when accessing protected routes

**Files to Modify:**
- `src/components/driver/AttendanceStatusCard.tsx`
  - Add refresh button
  - Show last updated timestamp

```typescript
<button
  onClick={() => fetchStatus()}
  className="text-sm text-blue-600 hover:text-blue-700"
>
  Refresh Status
</button>
<p className="text-xs text-gray-500">
  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
</p>
```

#### Edge Case 5: Multiple Devices/Sessions
**Scenario:** Driver logs in on multiple devices, clocks in on one device

**Solution:**
1. **Real-time Sync:**
   - Use WebSocket to broadcast clock-in/out events
   - All active sessions receive status updates

2. **Implementation:**
   - Add WebSocket event: `attendance:status:changed`
   - Subscribe to events in AttendanceStatusCard

**Files to Modify:**
- `src/services/websocket.ts`
  - Add attendance status events

```typescript
// Subscribe to attendance updates
socket.on('attendance:status:changed', (data) => {
  if (data.driverId === currentUserId) {
    // Update UI with new status
    setAttendanceStatus(data.status);
  }
});
```

#### Edge Case 6: Network Interruption During Clock In/Out
**Scenario:** Network fails during clock in/out request

**Solution:**
1. **Retry Logic:**
   - Implement exponential backoff retry
   - Queue failed requests for retry
   - Show pending status in UI

2. **Implementation:**
   - Add retry logic to attendanceIntegration.ts
   - Store pending actions in localStorage
   - Retry on network recovery

```typescript
async function clockInWithRetry(driverId: string, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await attendanceAPI.clockIn(driverId, 'MANUAL');
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}
```

#### Edge Case 7: Admin Viewing Driver Status
**Scenario:** Admin needs to see which drivers are currently clocked in

**Solution:**
1. **Admin Dashboard Enhancement:**
   - Show clock-in status for all drivers
   - Real-time updates via WebSocket
   - Filter by clocked in/out status

2. **Implementation:**
   - New admin page: `/admin/attendance/overview`
   - Fetch status for all drivers from attendance app

**New API Endpoint:**
`src/app/api/admin/attendance/all-drivers/route.ts`
```typescript
export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    const decoded = await verifyToken(token);
    if (decoded.role !== 'ADMIN' && decoded.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch all drivers
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER', isDeleted: false },
      select: { id: true, name: true },
    });

    // Fetch attendance status for each driver
    const statuses = await Promise.all(
      drivers.map(async (driver) => {
        try {
          const status = await attendanceAPI.getDriverStatus(driver.id);
          return {
            driverId: driver.id,
            driverName: driver.name,
            ...status,
          };
        } catch (error) {
          return {
            driverId: driver.id,
            driverName: driver.name,
            isActive: false,
            error: 'Unable to fetch status',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: statuses,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**New Admin Page:**
`src/app/admin/attendance/overview/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface DriverAttendanceStatus {
  driverId: string;
  driverName: string;
  isActive: boolean;
  clockInTime: Date | null;
  totalHoursWorked: number;
  isOnBreak: boolean;
}

export default function AttendanceOverviewPage() {
  const [drivers, setDrivers] = useState<DriverAttendanceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDriverStatuses();
    const interval = setInterval(fetchDriverStatuses, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchDriverStatuses = async () => {
    try {
      const response = await fetch('/api/admin/attendance/all-drivers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();
      setDrivers(data.data);
    } catch (error) {
      console.error('Failed to fetch driver statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const clockedInDrivers = drivers.filter(d => d.isActive);
  const clockedOutDrivers = drivers.filter(d => !d.isActive);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Driver Attendance Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="text-green-600" size={24} />
            <h2 className="text-lg font-semibold text-green-800">Clocked In</h2>
          </div>
          <p className="text-3xl font-bold text-green-600">{clockedInDrivers.length}</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="text-gray-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-800">Clocked Out</h2>
          </div>
          <p className="text-3xl font-bold text-gray-600">{clockedOutDrivers.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">All Drivers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Driver</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Clock In Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Hours Worked</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Break Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {drivers.map((driver) => (
                <tr key={driver.driverId}>
                  <td className="px-4 py-3 text-sm">{driver.driverName}</td>
                  <td className="px-4 py-3 text-sm">
                    {driver.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        <CheckCircle size={14} />
                        Clocked In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                        <XCircle size={14} />
                        Clocked Out
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {driver.clockInTime
                      ? new Date(driver.clockInTime).toLocaleTimeString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {driver.isActive ? `${driver.totalHoursWorked.toFixed(1)}h` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {driver.isOnBreak ? (
                      <span className="text-yellow-600">On Break</span>
                    ) : driver.isActive ? (
                      <span className="text-green-600">Working</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

### 3.6 SMS Notifications (FR-2.3) - Delegation to Attendance App

**Current State:**
- No SMS capability in B&R Driver App
- Attendance app may or may not have SMS notifications

**Decision:**
- **Overtime SMS notifications should be handled by the attendance app**, not the B&R Driver App
- The attendance app owns all time tracking data and is best positioned to monitor overtime
- B&R Driver App should not duplicate this functionality

**Required Changes:**
- **No SMS integration needed in B&R Driver App**
- Document that overtime notifications are the responsibility of the attendance app
- If attendance app doesn't have SMS, that feature should be added to the attendance app, not here

**Recommendation:**
If SMS notifications are required and the attendance app doesn't support them:
1. Add Twilio integration to the attendance app
2. Configure overtime thresholds in the attendance app
3. Attendance app monitors active shifts and sends SMS at thresholds
4. B&R Driver App remains focused on delivery operations

### 3.7 Testing Strategy for Attendance Integration

**Unit Tests:**
1. `tests/unit/attendanceIntegration.test.ts`
   - Test API client methods
   - Test cache behavior
   - Test error handling
   - Test fallback modes

2. `tests/unit/attendanceCheck.test.ts`
   - Test middleware logic
   - Test access control decisions
   - Test error responses

**Integration Tests:**
1. `tests/integration/attendanceFlow.test.ts`
   - Test clock in flow
   - Test clock out flow
   - Test status fetching
   - Test cache invalidation

2. `tests/integration/routeAccess.test.ts`
   - Test route access with active shift
   - Test route access without active shift
   - Test route access with API down

**E2E Tests:**
1. `tests/e2e/driverClockInWorkflow.test.ts`
   - Driver logs in
   - Sees clock-in prompt
   - Clocks in successfully
   - Accesses routes
   - Completes stops
   - Clocks out

**Mock Attendance API:**
Create mock server for testing:
`tests/mocks/attendanceAPI.ts`
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

export const attendanceHandlers = [
  rest.get('/api/shifts/current/:driverId', (req, res, ctx) => {
    return res(
      ctx.json({
        isActive: true,
        shiftId: 'shift-123',
        clockInTime: new Date(),
        clockOutTime: null,
        totalHoursWorked: 4.5,
        isOnBreak: false,
        breakType: null,
        overtimeStatus: {
          isOvertime: false,
          hoursWorked: 4.5,
          threshold: 8,
        },
      })
    );
  }),

  rest.post('/api/shifts/clock-in', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        shiftId: 'shift-123',
        clockInTime: new Date(),
        message: 'Clocked in successfully',
      })
    );
  }),

  rest.post('/api/shifts/clock-out', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        clockOutTime: new Date(),
        totalHoursWorked: 8.5,
        message: 'Clocked out successfully',
      })
    );
  }),
];

export const attendanceServer = setupServer(...attendanceHandlers);
```

### 3.8 Documentation Requirements

**API Documentation:**
Create documentation for attendance app API endpoints:
`docs/ATTENDANCE-API.md`
```markdown
# Attendance App API Integration

## Base URL
`https://attendance-app-url.com/api`

## Authentication
All requests require Bearer token in Authorization header.

## Endpoints

### Get Current Shift Status
`GET /shifts/current/:driverId`

Returns the current shift status for a driver.

**Response:**
```json
{
  "isActive": true,
  "shiftId": "shift-123",
  "clockInTime": "2025-11-20T08:00:00Z",
  "clockOutTime": null,
  "totalHoursWorked": 4.5,
  "isOnBreak": false,
  "breakType": null,
  "overtimeStatus": {
    "isOvertime": false,
    "hoursWorked": 4.5,
    "threshold": 8
  }
}
```

### Clock In
`POST /shifts/clock-in`

**Request Body:**
```json
{
  "driverId": "user-123",
  "method": "MANUAL",
  "barcode": "optional-barcode",
  "source": "BR_DRIVER_APP"
}
```

**Response:**
```json
{
  "success": true,
  "shiftId": "shift-123",
  "clockInTime": "2025-11-20T08:00:00Z",
  "message": "Clocked in successfully"
}
```

### Clock Out
`POST /shifts/clock-out`

**Request Body:**
```json
{
  "driverId": "user-123",
  "source": "BR_DRIVER_APP"
}
```

**Response:**
```json
{
  "success": true,
  "clockOutTime": "2025-11-20T17:00:00Z",
  "totalHoursWorked": 8.5,
  "message": "Clocked out successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "ALREADY_CLOCKED_IN",
  "message": "You are already clocked in"
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "error": "SERVICE_UNAVAILABLE",
  "message": "Attendance system is temporarily unavailable"
}
```
```

**Deployment Documentation:**
Update deployment docs with attendance integration setup:
`docs/DEPLOYMENT.md` (add section)
```markdown
## Attendance System Integration

### Environment Variables
Add the following to your `.env` file:

```
ATTENDANCE_API_BASE_URL=https://your-attendance-app.com/api
ATTENDANCE_API_KEY=your_api_key
ATTENDANCE_API_TIMEOUT=5000
ATTENDANCE_STATUS_CACHE_DURATION=300000
ATTENDANCE_API_FALLBACK_MODE=strict
```

### Testing the Integration
1. Verify attendance API is accessible:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://your-attendance-app.com/api/health
   ```

2. Test clock-in endpoint:
   ```bash
   curl -X POST \
        -H "Authorization: Bearer YOUR_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"driverId":"test-driver","method":"MANUAL","source":"BR_DRIVER_APP"}' \
        https://your-attendance-app.com/api/shifts/clock-in
   ```

### Monitoring
- Monitor attendance API response times
- Set up alerts for API downtime
- Track cache hit/miss rates
- Monitor fallback mode activations
```

---

## Summary of Milestone 3 Changes

### Comparison: Original Plan vs Revised Plan

| Aspect | Original Plan (Build From Scratch) | Revised Plan (API Integration) |
|--------|-----------------------------------|-------------------------------|
| **Approach** | Build complete time tracking system | Integrate with existing attendance app |
| **Database Models** | TimeEntry, BreakEntry, ClockMethod enum, BreakType enum | Minimal: attendanceAppUserId, cache fields only |
| **Backend Complexity** | High: Clock in/out logic, break tracking, overtime monitoring | Low: API client, middleware, proxy endpoints |
| **Frontend Components** | Barcode scanner, break tracker, lunch prompts, break timer | Clock-in status card, simple clock-in page, access guards |
| **External Services** | Twilio for SMS ($1/month + $0.0075/SMS) | Attendance app API (existing) |
| **Background Jobs** | Overtime monitoring cron job | None needed |
| **Time Tracking Logic** | Build from scratch, ensure compliance | Handled by attendance app |
| **SMS Notifications** | Build Twilio integration | Handled by attendance app |
| **Effort Estimate** | 2.5 weeks (13 days) | 2 weeks (10 days) |
| **Maintenance Burden** | High: Two systems to maintain | Low: Single integration point |
| **Risk Level** | High: Legal compliance, accuracy | Medium: API reliability |

### What We're NOT Building:
- ❌ Time tracking database models (TimeEntry, BreakEntry)
- ❌ Break tracking UI and logic
- ❌ Barcode scanner for clock-in
- ❌ Overtime monitoring background jobs
- ❌ SMS notification system (Twilio integration)
- ❌ Time calculation logic
- ❌ Break compliance checking
- ❌ Labor law compliance logic

### What We ARE Building:
- ✅ API integration service to communicate with attendance app
- ✅ Access control middleware to enforce clock-in requirement
- ✅ Clock-in status display in driver dashboard
- ✅ Clock-in/out trigger endpoints (proxy to attendance app)
- ✅ Route access guards based on shift status
- ✅ Error handling for API failures
- ✅ Cache strategy for performance (5-minute cache)
- ✅ Fallback mode for API downtime
- ✅ Admin overview of driver attendance status
- ✅ Comprehensive edge case handling (7 edge cases documented)
- ✅ WebSocket integration for real-time status updates
- ✅ API documentation and deployment guides

### Key Benefits of This Approach:
1. **Separation of Concerns:** Time tracking remains in dedicated attendance app
2. **No Data Duplication:** Single source of truth for time data
3. **Reduced Complexity:** B&R Driver App focuses on delivery operations
4. **Easier Maintenance:** Time tracking logic centralized in one place
5. **Flexibility:** Can swap attendance systems without major refactoring
6. **Lower Risk:** No legal compliance burden for time tracking
7. **Cost Savings:** No Twilio SMS costs
8. **Faster Implementation:** 3 days saved (10 days vs 13 days)

### Effort Estimate (Revised):
- API integration service: 2 days
- Access control middleware: 1 day
- Frontend components (status display, clock-in page): 2 days
- Admin attendance overview: 1 day
- Edge case handling: 2 days
- Testing & documentation: 2 days
- **Total: 10 days (2 weeks)**

**Savings:** 3 days compared to building from scratch (13 days → 10 days)

### Files Created (New):
1. `src/services/attendanceIntegration.ts` - API client service
2. `src/middleware/attendanceCheck.ts` - Access control middleware
3. `src/app/api/driver/attendance/status/route.ts` - Get status endpoint
4. `src/app/api/driver/attendance/clock-in/route.ts` - Clock in endpoint
5. `src/app/api/driver/attendance/clock-out/route.ts` - Clock out endpoint
6. `src/app/api/admin/attendance/all-drivers/route.ts` - Admin overview endpoint
7. `src/components/driver/AttendanceStatusCard.tsx` - Status display component
8. `src/components/driver/ClockInPromptModal.tsx` - Clock-in prompt modal
9. `src/components/driver/RouteAccessGuard.tsx` - Access guard component
10. `src/components/driver/SystemStatusBanner.tsx` - API status banner
11. `src/app/driver/clock-in/page.tsx` - Clock-in page
12. `src/app/admin/attendance/overview/page.tsx` - Admin attendance overview
13. `docs/ATTENDANCE-API.md` - API documentation
14. `tests/mocks/attendanceAPI.ts` - Mock API for testing

### Files Modified:
1. `prisma/schema.prisma` - Add attendance fields to User model
2. `src/app/api/driver/routes/route.ts` - Add attendance check
3. `src/app/api/driver/stops/route.ts` - Add attendance check
4. `src/app/api/driver/stops/[id]/route.ts` - Add attendance check
5. `src/app/api/driver/stops/[id]/complete/route.ts` - Add attendance check
6. `src/app/api/driver/stops/[id]/payment/route.ts` - Add attendance check
7. `src/app/api/driver/stops/[id]/returns/route.ts` - Add attendance check
8. `src/app/driver/page.tsx` - Add attendance status widget
9. `src/services/websocket.ts` - Add attendance status events
10. `.env` - Add attendance API configuration

### Prerequisites for Implementation:
1. ✅ Attendance app must have REST API endpoints
2. ✅ API credentials (API key or OAuth token)
3. ✅ API documentation from attendance app team
4. ✅ Staging environment for testing
5. ✅ SLA agreement for API availability
6. ✅ Monitoring setup for API health
---

## Milestone 4: Customer Experience & Route Optimization

### Overview
Enhanced customer information display, delivery instructions, Google Maps integration, and location tracking.

### 4.1 Customer Payment Terms Display (FR-3.1)

**Current State:**
- Customer model will have paymentTerms field (added in Milestone 1)
- Driver interface doesn't display payment terms

**Required Changes:**

#### Frontend Changes
**Files to Modify:**
1. `src/app/driver/stops/[id]/page.tsx` (Stop details page)
   - Display payment terms prominently
   - Show payment instructions based on terms

2. `src/components/driver/stops/CustomerInfoCard.tsx` (Lines 1-50)
   - Add payment terms badge
   - Color-code by payment type (COD = red, Net 30 = yellow, Prepaid = green)

**New Component:**
`src/components/driver/PaymentTermsBadge.tsx`
```typescript
// Visual badge for payment terms
// Color-coded: COD (red), Net 30 (yellow), Prepaid (green)
// Shows payment instructions on hover
```

### 4.2 Delivery Instructions Display (FR-3.2)

**Current State:**
- Customer model will have deliveryInstructions field (added in Milestone 1)
- Admin notes exist but separate from customer instructions

**Required Changes:**

#### Frontend Changes
**Files to Modify:**
1. `src/app/driver/stops/[id]/page.tsx` (Stop details page)
   - Display delivery instructions section
   - Show both customer instructions and admin notes

2. `src/components/driver/stops/CustomerInfoCard.tsx`
   - Add delivery instructions section
   - Highlight important instructions

**New Component:**
`src/components/driver/DeliveryInstructionsCard.tsx`
```typescript
// Display delivery instructions
// Show customer-specific instructions
// Show admin notes
// Highlight special requirements
```

### 4.3 Clickable Address Links (FR-4.1)

**Current State:**
- Google Maps integration exists
- GoogleMapsLink component exists (src/components/ui/GoogleMapsLink.tsx)

**Required Changes:**

#### Frontend Changes
**Files to Modify:**
1. `src/components/driver/stops/CustomerInfoCard.tsx` (Lines 1-50)
   - Ensure address is clickable
   - Use GoogleMapsLink component
   - Open in Google Maps app on mobile

**Verification:**
- Test on mobile devices
- Ensure opens in Google Maps app (not browser)
- Test on iOS and Android

### 4.4 Full Route Visualization (FR-4.2)

**Current State:**
- Google Maps utils exist (src/utils/googleMapsUtils.ts)
- Single-stop navigation works
- Full route visualization mentioned but needs enhancement

**Required Changes:**

#### Backend API Changes
**New Files to Create:**
1. `src/app/api/driver/routes/[id]/map-data/route.ts`
   - GET: Get all stops for route with coordinates
   - Return optimized order
   - Include stop status

#### Frontend Changes
**Files to Modify:**
1. `src/app/driver/stops/page.tsx` (Stop list page)
   - Add "View Full Route" button
   - Open Google Maps with all stops

2. `src/utils/googleMapsUtils.ts` (Lines 1-50)
   - Enhance multi-stop route generation
   - Add waypoint optimization parameter

**New Component:**
`src/components/driver/RouteMapView.tsx`
```typescript
// Embedded Google Maps view
// Shows all stops on map
// Color-coded by status
// Click to navigate to specific stop
```

### 4.5 Real-Time Location Tracking (FR-4.3)

**Current State:**
- No location tracking exists
- WebSocket infrastructure exists (Socket.io)

**Required Changes:**

#### Database Schema Changes
**File:** `prisma/schema.prisma`
```prisma
model LocationUpdate {
  id String @id @default(uuid())
  driverId String
  driver User @relation("DriverLocationUpdates", fields: [driverId], references: [id])
  routeId String?
  route Route? @relation(fields: [routeId], references: [id])

  latitude Float
  longitude Float
  accuracy Float? // GPS accuracy in meters
  speed Float? // Speed in km/h
  heading Float? // Direction in degrees

  timestamp DateTime @default(now())
  createdAt DateTime @default(now())
  isDeleted Boolean @default(false)

  @@index([driverId])
  @@index([routeId])
  @@index([timestamp])
  @@index([isDeleted])
  @@map("location_updates")
}
```

**Update User Model:**
```prisma
model User {
  // ... existing fields
  locationUpdates LocationUpdate[] @relation("DriverLocationUpdates")
  lastKnownLatitude Float?
  lastKnownLongitude Float?
  lastLocationUpdate DateTime?
  // ... rest of model
}
```

**Update Route Model:**
```prisma
model Route {
  // ... existing fields
  locationUpdates LocationUpdate[]
  // ... rest of model
}
```

#### Backend API Changes
**New Files to Create:**
1. `src/app/api/driver/location/update/route.ts`
   - POST: Update driver location
   - Store in database
   - Broadcast via WebSocket

2. `src/app/api/admin/routes/[id]/live-tracking/route.ts`
   - GET: Get live location data for route drivers
   - Return last known positions

**WebSocket Events:**
`src/services/websocket.ts` (Modify existing)
```typescript
// Add new events:
// 'driver:location:update' - Driver sends location
// 'admin:location:subscribe' - Admin subscribes to driver locations
// 'admin:location:data' - Server sends location to admin
```

#### Frontend Changes
**New Pages to Create:**
1. `src/app/admin/routes/[id]/live-tracking/page.tsx`
   - Live map view of driver locations
   - Show all drivers on route
   - Update every 30 seconds

**Files to Modify:**
1. `src/app/driver/stops/page.tsx` (Stop list page)
   - Add location tracking service
   - Send location every 2 minutes when on route

**New Components:**
1. `src/components/driver/LocationTracker.tsx`
   - Background location tracking
   - Uses Geolocation API
   - Sends updates via WebSocket

2. `src/components/admin/LiveTrackingMap.tsx`
   - Google Maps with driver markers
   - Real-time position updates
   - Click driver marker for details

**New Service:**
`src/services/locationTracking.ts`
```typescript
// Client-side location tracking service
// Requests location permission
// Tracks location in background
// Sends updates to server
// Handles errors and permissions
```

---

## Milestone 5: KPI Tracking & Reporting

### Overview
Comprehensive KPI data capture and reporting dashboard for performance analysis.

### 5.1 KPI Data Capture (FR-7.1)

**Current State:**
- Stop model has timing data
- Payment tracking exists
- No aggregated KPI tracking

**Required Changes:**

#### Database Schema Changes
**File:** `prisma/schema.prisma`
```prisma
model DailyKPI {
  id String @id @default(uuid())
  driverId String
  driver User @relation("DriverDailyKPIs", fields: [driverId], references: [id])
  routeId String?
  route Route? @relation(fields: [routeId], references: [id])
  vehicleId String?
  vehicle Vehicle? @relation(fields: [vehicleId], references: [id])

  date DateTime // Date of the KPI (start of day)

  // Time metrics
  clockInTime DateTime?
  clockOutTime DateTime?
  totalWorkMinutes Int? // Total time clocked in
  totalBreakMinutes Int? // Total break time
  totalProductiveMinutes Int? // Work time minus breaks

  // Distance metrics
  startingMileage Float? // Odometer at start
  endingMileage Float? // Odometer at end
  totalMilesDriven Float? // Calculated difference

  // Delivery metrics
  totalStops Int @default(0) // Total stops assigned
  completedStops Int @default(0) // Stops completed
  failedStops Int @default(0) // Stops not completed
  totalAmountDelivered Float @default(0) // Sum of all deliveries

  // Payment metrics
  cashCollected Float @default(0)
  checkCollected Float @default(0)
  creditCardCollected Float @default(0)
  totalPaymentsCollected Float @default(0)

  // Return metrics
  totalReturns Int @default(0)
  returnValue Float @default(0)

  // Efficiency metrics
  averageStopTime Float? // Average minutes per stop
  onTimePercentage Float? // Percentage of on-time deliveries

  // Fuel metrics (if applicable)
  fuelUsed Float? // Gallons or liters
  fuelCost Float?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean @default(false)

  @@unique([driverId, date])
  @@index([driverId])
  @@index([routeId])
  @@index([vehicleId])
  @@index([date])
  @@index([isDeleted])
  @@map("daily_kpis")
}
```

**Update User Model:**
```prisma
model User {
  // ... existing fields
  dailyKPIs DailyKPI[] @relation("DriverDailyKPIs")
  // ... rest of model
}
```

**Update Route Model:**
```prisma
model Route {
  // ... existing fields
  dailyKPIs DailyKPI[]
  // ... rest of model
}
```

**Update Vehicle Model:**
```prisma
model Vehicle {
  // ... existing fields
  dailyKPIs DailyKPI[]
  // ... rest of model
}
```

#### Backend API Changes
**New Service File:**
`src/services/kpiCalculation.ts`
```typescript
// Service to calculate and update KPIs
// Runs at end of day or on-demand
// Aggregates data from TimeEntry, Stop, Payment, Return models
// Creates/updates DailyKPI records

export async function calculateDailyKPI(
  driverId: string,
  date: Date
): Promise<DailyKPI> {
  // Fetch all relevant data for the day
  // Calculate metrics
  // Create or update DailyKPI record
  // Return KPI data
}

export async function recalculateKPI(
  kpiId: string
): Promise<DailyKPI> {
  // Recalculate existing KPI
  // Useful for corrections
}
```

**New Files to Create:**
1. `src/app/api/admin/kpis/calculate/route.ts`
   - POST: Trigger KPI calculation for specific driver/date
   - Used for manual recalculation

2. `src/app/api/admin/kpis/route.ts`
   - GET: List KPIs with filters (driver, date range, etc.)

3. `src/app/api/admin/kpis/[id]/route.ts`
   - GET: Get specific KPI details

4. `src/app/api/driver/kpis/my-kpis/route.ts`
   - GET: Get driver's own KPIs

**Files to Modify:**
1. `src/app/api/driver/time/clock-out/route.ts`
   - Trigger KPI calculation on clock out

2. `src/app/api/driver/stops/[id]/complete/route.ts`
   - Update KPI metrics when stop completed

### 5.2 KPI Reporting Dashboard (FR-7.2)

**Current State:**
- No reporting dashboard exists
- Admin dashboard is basic

**Required Changes:**

#### Dependencies to Add
```bash
npm install recharts date-fns
# For charts and date manipulation
```

#### Frontend Changes
**New Pages to Create:**
1. `src/app/admin/reports/kpis/page.tsx`
   - Main KPI dashboard
   - Date range selector
   - Driver filter
   - Multiple chart views

2. `src/app/admin/reports/kpis/driver/[id]/page.tsx`
   - Individual driver KPI report
   - Detailed metrics
   - Historical trends

3. `src/app/driver/my-performance/page.tsx`
   - Driver's own KPI view
   - Personal metrics
   - Goals and achievements

**New Components:**
1. `src/components/admin/reports/KPIOverviewCards.tsx`
   - Summary cards for key metrics
   - Total miles, deliveries, revenue, etc.

2. `src/components/admin/reports/KPICharts.tsx`
   - Line charts for trends
   - Bar charts for comparisons
   - Pie charts for distributions

3. `src/components/admin/reports/DriverPerformanceTable.tsx`
   - Sortable table of driver KPIs
   - Export to CSV functionality

4. `src/components/admin/reports/KPIFilters.tsx`
   - Date range picker
   - Driver multi-select
   - Vehicle filter
   - Metric selector

5. `src/components/admin/reports/PerformanceComparison.tsx`
   - Compare multiple drivers
   - Side-by-side metrics
   - Ranking system

**Chart Types to Implement:**
- **Miles Driven Over Time** (Line chart)
- **Deliveries by Driver** (Bar chart)
- **Revenue by Payment Method** (Pie chart)
- **Average Stop Time Trend** (Line chart)
- **On-Time Delivery Rate** (Gauge chart)
- **Returns by Reason** (Bar chart)
- **Fuel Efficiency** (Line chart)
- **Overtime Hours** (Bar chart)

### 5.3 Export Functionality

**Current State:**
- CSV export exists for routes (src/services/routeOperations.ts)

**Required Changes:**

#### Backend API Changes
**New Files to Create:**
1. `src/app/api/admin/reports/kpis/export/route.ts`
   - GET: Export KPI data to CSV/Excel
   - Support date range and driver filters

**New Service:**
`src/services/kpiExport.ts`
```typescript
// Export KPI data to various formats
// CSV, Excel, PDF report
// Include charts in PDF export
```

#### Frontend Changes
**Files to Modify:**
1. `src/app/admin/reports/kpis/page.tsx`
   - Add export buttons
   - CSV, Excel, PDF options

---

## Cross-Cutting Concerns

### 5.4 Mobile Responsiveness

**Current State:**
- Application has mobile layouts
- Driver interface is mobile-optimized

**Required Changes:**

**Files to Review and Enhance:**
1. All new driver pages (clock-in, breaks, location tracking)
   - Ensure touch-friendly buttons (min 44px height)
   - Test on iOS and Android
   - Optimize for portrait orientation

2. All new admin pages (KPI dashboard, live tracking)
   - Responsive breakpoints
   - Mobile-friendly tables (horizontal scroll or cards)

### 5.5 Performance Optimization

**Considerations:**
1. **Location Tracking**
   - Batch location updates (every 2 minutes, not real-time)
   - Use WebSocket for efficiency
   - Implement location update throttling

2. **KPI Calculations**
   - Run as background jobs, not on-demand
   - Cache calculated KPIs
   - Use database indexes for fast queries

3. **Document Management**
   - Implement pagination (already exists)
   - Lazy load document previews
   - Compress uploaded files

4. **Live Tracking Map**
   - Limit map updates to visible drivers
   - Use marker clustering for many drivers
   - Implement map bounds optimization

### 5.6 Error Handling & Logging

**New Utility:**
`src/lib/errorTracking.ts`
```typescript
// Centralized error tracking
// Log errors to database or external service
// Send alerts for critical errors
```

**Files to Modify:**
- All new API routes should use consistent error handling
- Log errors with context (user, action, timestamp)
- Return user-friendly error messages

### 5.7 Testing Strategy

**Recommended Tests:**
1. **Unit Tests**
   - KPI calculation logic
   - Location tracking utilities
   - Time tracking calculations
   - Break compliance logic

2. **Integration Tests**
   - Clock in/out flow
   - Break tracking flow
   - KPI calculation end-to-end
   - SMS notification sending

3. **E2E Tests**
   - Driver clock-in workflow
   - Admin KPI dashboard
   - Live tracking map

**Testing Files to Create:**
1. `tests/unit/kpiCalculation.test.ts`
2. `tests/unit/timeTracking.test.ts`
3. `tests/integration/clockInOut.test.ts`
4. `tests/e2e/driverWorkflow.test.ts`

---

## Deployment Considerations

### 5.8 Environment Variables

**New Variables to Add:**
```env
# Attendance App Integration (Milestone 3)
ATTENDANCE_API_BASE_URL=https://attendance-app-url.com/api
ATTENDANCE_API_KEY=your_api_key_here
ATTENDANCE_API_TIMEOUT=5000 # 5 seconds
ATTENDANCE_STATUS_CACHE_DURATION=300000 # 5 minutes in ms
ATTENDANCE_API_FALLBACK_MODE=strict # 'strict' or 'permissive'

# Location Tracking (Milestone 4)
LOCATION_UPDATE_INTERVAL=120000 # 2 minutes in ms
LOCATION_TRACKING_ENABLED=true

# KPI Calculation (Milestone 5)
KPI_CALCULATION_TIME=23:00 # Run at 11 PM daily
KPI_AUTO_CALCULATE=true
```

**Removed Variables (No longer needed):**
- ~~TWILIO_ACCOUNT_SID~~ - SMS handled by attendance app
- ~~TWILIO_AUTH_TOKEN~~ - SMS handled by attendance app
- ~~TWILIO_PHONE_NUMBER~~ - SMS handled by attendance app
- ~~ADMIN_PHONE_NUMBER~~ - SMS handled by attendance app
- ~~OVERTIME_THRESHOLD_1~~ - Overtime monitoring handled by attendance app
- ~~OVERTIME_THRESHOLD_2~~ - Overtime monitoring handled by attendance app
- ~~OVERTIME_THRESHOLD_3~~ - Overtime monitoring handled by attendance app

### 5.9 Database Migrations

**Migration Strategy:**
1. **Milestone 1 Migrations**
   - Add paymentTerms, deliveryInstructions to Customer
   - Create Vehicle, VehicleAssignment models
   - Update DocumentType enum

2. **Milestone 2 Migrations**
   - Create SystemDocument model
   - No major schema changes

3. **Milestone 3 Migrations** - REVISED
   - Add attendanceAppUserId to User
   - Add lastClockInStatusCheck to User
   - Add cachedClockInStatus to User
   - No time tracking models needed (handled by attendance app)

4. **Milestone 4 Migrations**
   - Create LocationUpdate model
   - Add location fields to User

5. **Milestone 5 Migrations**
   - Create DailyKPI model
   - Add KPI relations to User, Route, Vehicle

**Migration Commands:**
```bash
# After each schema change
npx prisma migrate dev --name descriptive_migration_name
npx prisma generate
```

### 5.10 Deployment Steps

**For Each Milestone:**
1. **Local Development**
   - Implement features
   - Test thoroughly
   - Run migrations locally

2. **VPS Deployment**
   ```bash
   # SSH into server
   ssh user@your-vps-ip

   # Navigate to app directory
   cd /path/to/app

   # Pull latest code
   git pull origin main

   # Install dependencies
   npm install

   # Run migrations
   npx prisma migrate deploy
   npx prisma generate

   # Build application
   npm run build

   # Restart PM2
   pm2 restart all

   # Check status
   pm2 status
   pm2 logs
   ```

3. **Post-Deployment Verification**
   - Test critical workflows
   - Check error logs
   - Verify database migrations
   - Test on mobile devices

---

## Risk Assessment & Mitigation

### High-Risk Items

1. **Attendance API Integration Reliability**
   - **Risk:** Attendance API downtime blocks all driver operations
   - **Mitigation:**
     - Implement robust caching strategy (5-minute cache)
     - Fallback mode configuration (strict vs permissive)
     - Monitor API health and response times
     - Set up alerts for API failures
     - Document emergency procedures for API outages
     - Consider circuit breaker pattern for repeated failures

2. **Real-Time Location Tracking**
   - **Risk:** Battery drain, privacy concerns, GPS accuracy issues
   - **Mitigation:**
     - Update interval of 2 minutes (not real-time)
     - Allow drivers to disable when not on route
     - Clear privacy policy
     - Use low-power location mode

3. **Clock-In Status Cache Staleness**
   - **Risk:** Drivers access routes with outdated cached status
   - **Mitigation:**
     - Short cache duration (5 minutes)
     - Force refresh on critical actions
     - WebSocket updates for real-time sync
     - Manual refresh option in UI
     - Log cache hits/misses for monitoring

4. **KPI Calculation Performance**
   - **Risk:** Slow queries, database load
   - **Mitigation:**
     - Run calculations as background jobs
     - Use database indexes extensively
     - Cache calculated KPIs
     - Implement query optimization

5. **Driver Clocking Out Mid-Route**
   - **Risk:** Incomplete deliveries, data inconsistency
   - **Mitigation:**
     - Check for incomplete stops before allowing clock out
     - Require confirmation with warning
     - Admin override capability
     - Log all clock-out attempts with incomplete stops

### Medium-Risk Items

1. **Attendance API Response Time**
   - **Risk:** Slow API responses delay driver operations
   - **Mitigation:**
     - Set aggressive timeout (5 seconds)
     - Use cached data when available
     - Async status checks where possible
     - Monitor API performance metrics

2. **Document Categorization Migration**
   - **Risk:** Existing documents need recategorization
   - **Mitigation:**
     - Create migration script
     - Map old types to new categories
     - Allow admin to review and correct

3. **Vehicle Assignment Logic**
   - **Risk:** Conflicts if vehicle assigned to multiple drivers
   - **Mitigation:**
     - Enforce one active assignment per vehicle
     - Validation at API level
     - Clear UI indicators

4. **Password Confirmation for Deletions**
   - **Risk:** User frustration, forgotten passwords
   - **Mitigation:**
     - Clear messaging about security
     - Password reset flow
     - Option to disable for non-critical items

5. **Multiple Device Sessions**
   - **Risk:** Clock-in status out of sync across devices
   - **Mitigation:**
     - WebSocket broadcasts for status changes
     - Force refresh on app focus
     - Show last updated timestamp

---

## Effort Estimates

### Milestone 1 (2.5 weeks)
- Customer payment terms: 2 days
- Vehicle management: 5 days
- Document categories: 2 days
- Conditional fuel instructions: 2 days
- Testing & bug fixes: 2 days

### Milestone 2 (2.5 weeks)
- Document search: 3 days
- PDF print button fix: 1 day
- Daily safety declaration: 3 days
- Password confirmation: 3 days
- Testing & bug fixes: 2 days

### Milestone 3 (2 weeks) - REVISED
- API integration service: 2 days
- Access control middleware: 1 day
- Frontend components (status display, clock-in page): 2 days
- Admin attendance overview: 1 day
- Edge case handling: 2 days
- Testing & documentation: 2 days

### Milestone 4 (2.5 weeks)
- Payment terms display: 1 day
- Delivery instructions: 1 day
- Clickable addresses: 1 day
- Full route visualization: 3 days
- Location tracking: 6 days
- Testing & bug fixes: 2 days

### Milestone 5 (2.5 weeks)
- KPI schema: 1 day
- KPI calculation service: 4 days
- KPI dashboard: 6 days
- Export functionality: 2 days
- Testing & deployment: 2 days

**Total Estimated Effort:** 12 weeks (with buffer)

**Note:** Milestone 3 effort reduced from 2.5 weeks to 2 weeks due to API integration approach instead of building time tracking from scratch.

---

## Dependencies & Prerequisites

### External Services
1. **Attendance Application API** (Milestone 3) - CRITICAL
   - Ensure attendance app has REST API endpoints
   - Obtain API credentials (API key or OAuth)
   - Document API endpoints and response formats
   - Set up staging/production environments
   - Establish SLA for API availability
   - Configure monitoring and alerts

2. **Google Maps API** (Already configured)
   - Ensure sufficient quota for increased usage
   - Monitor API usage

**Note:** Twilio SMS integration is NOT required for B&R Driver App. Overtime notifications should be handled by the attendance application.

### Development Tools
1. **HTTP Client for API Integration** (Milestone 3)
   - Axios (already in use)
   - Configure retry logic and timeouts

2. **Chart Library** (Milestone 5)
   - Recharts (recommended)
   - Lightweight, React-friendly

**Note:** Barcode scanner library is NOT required. Clock-in via barcode is handled by the attendance application.

### Infrastructure
1. **Database Backup Strategy**
   - Implement before major migrations
   - Automated daily backups

2. **Monitoring & Alerting**
   - Set up error tracking (Sentry, LogRocket, etc.)
   - Monitor API response times
   - Track SMS delivery rates

---

## Success Criteria

### Milestone 1
- ✅ Admins can set payment terms for customers
- ✅ Vehicles can be created and assigned to drivers
- ✅ Documents can be categorized into 5 types
- ✅ Drivers see fuel instructions based on vehicle type

### Milestone 2
- ✅ Admins can search documents by keyword, category, date
- ✅ PDF print button works correctly on all devices
- ✅ Daily safety declaration is available to drivers
- ✅ All deletions require password confirmation

### Milestone 3 - REVISED
- ✅ B&R Driver App successfully integrates with attendance app API
- ✅ Drivers can view clock-in status in the driver dashboard
- ✅ Drivers can trigger clock in/out from B&R Driver App
- ✅ Route access is blocked when driver is not clocked in
- ✅ Access control works correctly with proper error messages
- ✅ Cache strategy improves performance without stale data
- ✅ Fallback mode handles attendance API downtime gracefully
- ✅ Admin can view all drivers' clock-in status
- ✅ Edge cases (mid-route clock out, API failures) are handled properly

### Milestone 4
- ✅ Drivers see payment terms and delivery instructions
- ✅ Addresses are clickable and open in Google Maps
- ✅ Full route visualization shows all stops
- ✅ Admin can track driver locations in real-time

### Milestone 5
- ✅ KPIs are calculated automatically at end of day
- ✅ Admin dashboard shows comprehensive KPI reports
- ✅ Reports can be exported to CSV/Excel
- ✅ Drivers can view their own performance metrics

---

## Conclusion

This implementation plan provides a comprehensive roadmap for enhancing the B&R Driver App over the next 3 months. The phased approach ensures manageable development cycles with clear deliverables at each milestone.

### Key Recommendations

1. **Prioritize Testing**
   - Time tracking and KPI calculations are critical
   - Implement comprehensive unit and integration tests
   - Test on actual devices (iOS and Android)

2. **User Training**
   - Create training materials for new features
   - Conduct training sessions before each milestone deployment
   - Provide quick reference guides

3. **Gradual Rollout**
   - Consider beta testing with subset of drivers
   - Gather feedback before full deployment
   - Be prepared to iterate based on user feedback

4. **Performance Monitoring**
   - Monitor database query performance
   - Track API response times
   - Optimize as needed

5. **Documentation**
   - Document all new APIs
   - Update user manuals
   - Maintain deployment runbooks

### Next Steps

1. **Review and Approval**
   - Review this analysis with stakeholders
   - Confirm priorities and timeline
   - Approve budget for external services (Twilio)

2. **Environment Setup**
   - Set up development environment
   - Configure Twilio account
   - Prepare staging environment

3. **Kickoff Milestone 1**
   - Begin with database schema changes
   - Implement customer payment terms
   - Start vehicle management system

---

**Document Version:** 1.0
**Last Updated:** November 20, 2025
**Next Review:** Start of each milestone

