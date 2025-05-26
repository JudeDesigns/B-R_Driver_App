# B&R Food Services - API Documentation

## Authentication

All API endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Login
**POST** `/api/auth/login`

Request body:
```json
{
  "username": "string",
  "password": "string"
}
```

Response:
```json
{
  "token": "jwt_token",
  "user": {
    "id": "string",
    "username": "string",
    "role": "ADMIN|DRIVER",
    "fullName": "string"
  }
}
```

## Admin Endpoints

### Dashboard
**GET** `/api/admin/dashboard`

Response:
```json
{
  "todaysRoutes": [
    {
      "id": "string",
      "routeNumber": "string",
      "status": "PENDING|IN_PROGRESS|COMPLETED",
      "driver": {
        "id": "string",
        "username": "string",
        "fullName": "string"
      },
      "_count": {
        "stops": "number"
      }
    }
  ],
  "stats": {
    "completedStops": "number",
    "activeRoutes": "number",
    "activeDrivers": "number",
    "ongoingDeliveries": "number"
  },
  "emailStats": {
    "sent": "number",
    "pending": "number",
    "failed": "number"
  }
}
```

### Routes
**GET** `/api/admin/routes`

Query parameters:
- `date`: Filter by date (YYYY-MM-DD)
- `driverId`: Filter by driver ID
- `status`: Filter by status
- `limit`: Number of results (default: 10)
- `offset`: Pagination offset (default: 0)

**GET** `/api/admin/routes/{id}`

**POST** `/api/admin/routes/upload`

### Customers
**GET** `/api/admin/customers`

Query parameters:
- `search`: Search term
- `limit`: Number of results
- `offset`: Pagination offset

**POST** `/api/admin/customers`

Request body:
```json
{
  "name": "string",
  "address": "string",
  "contactInfo": "string",
  "email": "string",
  "groupCode": "string"
}
```

**GET** `/api/admin/customers/{id}`

**PUT** `/api/admin/customers/{id}`

### Users
**GET** `/api/admin/users`

Query parameters:
- `role`: Filter by role (ADMIN|DRIVER)
- `search`: Search term

**POST** `/api/admin/users`

Request body:
```json
{
  "username": "string",
  "password": "string",
  "role": "ADMIN|DRIVER",
  "fullName": "string"
}
```

**GET** `/api/admin/users/{id}`

**PUT** `/api/admin/users/{id}`

### Stops
**GET** `/api/admin/stops`

Query parameters:
- `routeId`: Filter by route ID
- `status`: Filter by status
- `customerId`: Filter by customer ID

**GET** `/api/admin/stops/{id}`

**POST** `/api/admin/stops/{id}/send-email`

### Safety Checks
**GET** `/api/admin/safety-checks`

Query parameters:
- `driverId`: Filter by driver ID
- `type`: Filter by type (START_OF_DAY|END_OF_DAY)
- `dateFrom`: Start date filter
- `dateTo`: End date filter

## Driver Endpoints

### Assigned Routes
**GET** `/api/driver/assigned-routes`

Query parameters:
- `date`: Filter by date (YYYY-MM-DD)
- `status`: Filter by status

Response:
```json
{
  "routes": [
    {
      "id": "string",
      "routeNumber": "string",
      "status": "PENDING|IN_PROGRESS|COMPLETED",
      "date": "string",
      "stops": [
        {
          "id": "string",
          "stopNumber": "number",
          "status": "PENDING|ON_THE_WAY|ARRIVED|COMPLETED",
          "customer": {
            "name": "string",
            "address": "string"
          }
        }
      ]
    }
  ]
}
```

### Route Details
**GET** `/api/driver/routes/{id}`

### Stop Management
**PUT** `/api/driver/stops/{id}`

Request body:
```json
{
  "status": "ON_THE_WAY|ARRIVED|COMPLETED",
  "driverNotes": "string",
  "signedInvoicePdfUrl": "string"
}
```

### Returns
**POST** `/api/driver/returns`

Request body:
```json
{
  "stopId": "string",
  "reason": "string",
  "quantity": "number",
  "productName": "string"
}
```

**GET** `/api/driver/returns`

### Safety Checks
**POST** `/api/driver/safety-check`

Request body:
```json
{
  "routeId": "string",
  "type": "START_OF_DAY|END_OF_DAY",
  "vehicleInspection": "boolean",
  "equipmentCheck": "boolean",
  "notes": "string"
}
```

**GET** `/api/driver/safety-check/status`

Query parameters:
- `date`: Date to check (YYYY-MM-DD)

## Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Unprocessable Entity
- `500`: Internal Server Error

## Error Response Format

```json
{
  "message": "Error description",
  "error": "Error details (in development mode)"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per minute per IP address
- 1000 requests per hour per authenticated user

## WebSocket Events

The system uses WebSocket for real-time updates:

### Connection
Connect to `/socket.io` with authentication token

### Events
- `ROUTE_STATUS_UPDATED`: Route status changed
- `STOP_STATUS_UPDATED`: Stop status changed
- `ADMIN_NOTE_ADDED`: Admin note added to stop

### Event Data Format
```json
{
  "type": "ROUTE_STATUS_UPDATED",
  "data": {
    "routeId": "string",
    "status": "string",
    "timestamp": "string"
  }
}
```

## File Upload

### Route Upload
**POST** `/api/admin/routes/upload`

Content-Type: `multipart/form-data`

Form data:
- `file`: Excel (.xlsx) or CSV file

### Invoice Upload
**POST** `/api/driver/stops/{id}/upload-invoice`

Content-Type: `multipart/form-data`

Form data:
- `invoice`: Image file (JPEG, PNG)

## Data Export

Add `export=true` query parameter to GET endpoints to download data as CSV:

Examples:
- `/api/admin/customers?export=true`
- `/api/admin/routes?date=2024-01-01&export=true`
- `/api/admin/safety-checks?export=true`

## Pagination

List endpoints support pagination:

Query parameters:
- `limit`: Number of results per page (default: 10, max: 100)
- `offset`: Number of results to skip (default: 0)

Response includes pagination metadata:
```json
{
  "data": [...],
  "total": "number",
  "limit": "number",
  "offset": "number"
}
```

## Filtering and Search

Most list endpoints support filtering and search:

Common query parameters:
- `search`: Full-text search
- `status`: Filter by status
- `date`: Filter by date
- `dateFrom`/`dateTo`: Date range filter

## Caching

API responses are cached for performance:
- Dashboard data: 30 seconds
- Route data: 1 minute
- Customer data: 5 minutes

Use `Cache-Control: no-cache` header to bypass cache.

## Development vs Production

### Development Mode
- Detailed error messages
- Debug logging
- CORS enabled for localhost

### Production Mode
- Minimal error messages
- Error logging only
- Strict CORS policy
- Rate limiting enforced
