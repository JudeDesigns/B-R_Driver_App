# B&R Food Services Admin & Driver Web System

This is a web-based system for B&R Food Services consisting of an Admin Console and a Driver Portal. The system aims to streamline route management, automate delivery tracking, digitize data capture, improve communication, and enhance operational efficiency.

## Phase 1: Foundation & Login

This initial phase includes:

- Project infrastructure setup (codebase, database)
- Functional login screens for Admin and Driver roles
- Basic application navigation shells

## Tech Stack

- **Frontend**: Next.js with TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT
- **Password Hashing**: Argon2
- **Real-time Communication**: Socket.io (to be implemented in Phase 4)

## Setup Instructions

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL database

### Installation

1. Clone the repository:

   ```
   git clone <repository-url>
   cd br-food-services
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following content:

   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/br_food_services"
   JWT_SECRET="your-secret-key-here"
   NEXT_PUBLIC_API_URL="http://localhost:3000/api"
   ```

   Replace the database credentials with your own.

4. Set up the database:

   ```
   npx prisma migrate dev --name init
   ```

5. Seed the database with initial data:

   ```
   npm run db:seed
   ```

6. Start the development server:

   ```
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Authentication

The system uses JWT-based authentication with database-stored credentials.

### Default Administrator Account

After running the database seed script, the following administrator account will be available:

- Username: Administrator
- Password: Administrator

## Project Structure

- `src/app`: Next.js App Router
  - `admin`: Admin Console pages
  - `driver`: Driver Portal pages
  - `login`: Authentication page
  - `api`: API endpoints
- `src/components`: Reusable UI components
- `src/lib`: Utility functions and shared code
- `prisma`: Database schema and migrations

## Development Roadmap

### Phase 1: Foundation & Login (Current)

- Set up project infrastructure
- Build functional login screens
- Create basic application navigation shells

### Phase 2: Route Upload & Display

- Develop Admin feature to upload routes via Excel
- Build Admin screen to display uploaded routes/stops
- Build Driver screen to display their assigned route/stops

### Phase 3: Driver Stop Actions & Basic Data Capture

- Implement Driver status update buttons
- Build invoice photo upload feature
- Implement PDF generation from photos
- Build Driver Notes entry feature

### Phase 4: Live Tracking & Admin Communication

- Implement real-time updates for status changes
- Build feature for Admins to send notes for specific stops
- Ensure Drivers receive/view these notes

### Phase 5: Handling Returns & End-of-Day Process

- Develop Driver screens for logging returns
- Build Admin view for logged returns
- Create End-of-Route screen for Drivers

### Phase 6: MVP Completion

- Integrate mandatory Safety Checklists
- Implement basic Admin Customer management
- Add basic Admin filtering
- Set up automated Customer Confirmation Email
- Add basic Super Admin tools
- Apply consistent UI styling
- Conduct integration testing
