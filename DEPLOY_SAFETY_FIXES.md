# Production Deployment Guide: Driver App & Admin Updates (Jan 2026)

Follow these steps to deploy the latest fixes and enhancements to your production AlmaLinux server.

## Updates Included
-   **Driver App**: Fixed text formatting (line breaks), clickable links in notes, and auto-start next stop logic.
-   **Admin Panel**: Super Admin User List now hides deleted users.
-   **Email**: Delivery confirmation emails now include "Driver Notes".
-   **Vehicle Management**: "Start of Day" form now correctly finds the driver's globally assigned vehicle.

## 1. Pull Code Changes
Ensure the latest code is pulled from the repository.
```bash
git pull origin main
```

## 2. Update Database & Client
Synchronize the database schema (if any pending changes exist) and regenerate the Prisma client.
```bash
npx prisma db push
npx prisma generate
```
> [!NOTE]
> This ensures the local Prisma client (used by the app) matches the current database schema.

## 3. Rebuild the Application
Recompile the Next.js application to apply the frontend and API changes.
```bash
npm run build
```

## 4. Restart the Process
Restart the application using PM2 to load the new code.
```bash
pm2 restart br-driver-app
```

## 5. Verification Steps

### Driver App
1.  **Formatting**: Check a stop with multi-line notes. Ensure line breaks render correctly.
2.  **Auto-Start**: Complete a stop. Verity the app redirects to the next stop and its status updates to "ON THE WAY".
3.  **Vehicle**: Go to "Start of Day". Verify your assigned vehicle is pre-selected, even if not linked to today's route.

### Admin & Email
1.  **User List**: Log in as Super Admin. Check the User List to ensure no "deleted" users appear.
2.  **Email**: Complete a delivery with notes. Check the confirmation email to verify "Driver Notes" are verified in the body.
