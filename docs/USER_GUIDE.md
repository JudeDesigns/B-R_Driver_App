# B&R Food Services - User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Admin Interface](#admin-interface)
3. [Driver Interface](#driver-interface)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Mobile device or tablet for drivers (recommended)

### Logging In
1. Navigate to the system URL
2. Enter your username and password
3. Click "Sign In"
4. You'll be redirected to your role-specific dashboard

### Default Accounts
- **Administrator**: Username: `Administrator`, Password: `Administrator`

## Admin Interface

### Dashboard Overview
The admin dashboard provides a comprehensive view of daily operations:

- **Today's Routes**: Number of routes scheduled for today
- **Completed Stops**: Number of deliveries completed
- **Active Drivers**: Number of drivers currently working
- **Ongoing Deliveries**: Number of deliveries in progress
- **Email Notifications**: Status of customer confirmation emails

### Route Management

#### Uploading Routes
1. Navigate to **Routes** → **Upload Route**
2. Select your Excel/CSV file
3. Click **Upload**
4. Review the parsed data
5. Click **Confirm Upload**

**File Format Requirements:**
- Excel (.xlsx) or CSV format
- Must contain driver names, customer information, and stop details
- Group codes should be in column G
- Driver notes in column AC
- Invoice numbers in column AI

#### Managing Routes
1. Go to **Routes** → **Manage Routes**
2. Use filters to find specific routes:
   - Filter by date
   - Filter by driver
   - Filter by status
3. Click on a route to view details
4. Monitor real-time status updates

#### Route Details
- View all stops for a route
- Monitor driver progress
- Add admin notes to specific stops
- Send customer confirmation emails

### Customer Management

#### Adding Customers
1. Navigate to **Customers** → **Add Customer**
2. Fill in required information:
   - Name (required)
   - Address (required)
   - Contact information
   - Email address
   - Group code
3. Click **Save**

#### Managing Customers
1. Go to **Customers**
2. Use search to find specific customers
3. Click **Edit** to modify customer information
4. Export customer data using the **Export** button

### User Management

#### Adding Drivers
1. Navigate to **Users** → **Add User**
2. Fill in driver information:
   - Username (required)
   - Password (required)
   - Full name
   - Role: Driver
3. Click **Create User**

#### Managing Users
1. Go to **Users**
2. Filter by role (Admin/Driver)
3. Edit user information as needed
4. Reset passwords when necessary

### Safety Check Monitoring
1. Navigate to **Safety Checks**
2. View all safety check submissions
3. Filter by date, driver, or type
4. Monitor compliance and completion rates

### Email Management
- Customer confirmation emails are sent automatically when deliveries are completed
- Monitor email status in the dashboard
- Manually send emails from stop details if needed

## Driver Interface

### Dashboard
The driver dashboard shows:
- Today's assigned routes
- Current delivery status
- Safety checklist requirements

### Daily Workflow

#### 1. Start of Day
1. Log into the system
2. Review assigned routes
3. Complete start-of-day safety checklist:
   - Vehicle inspection
   - Equipment check
   - Add any notes
4. Click **Submit Safety Check**

#### 2. Route Execution
1. Navigate to **Stops** to see your delivery list
2. For each stop:
   - Click **On the Way** when departing
   - Click **Arrived** when you reach the customer
   - Complete delivery tasks
   - Upload signed invoice (photo)
   - Add any delivery notes
   - Process returns if necessary
   - Click **Complete Delivery**

#### 3. Handling Returns
1. When at a stop, click **Add Return**
2. Fill in return information:
   - Product name
   - Quantity
   - Reason for return
3. Click **Submit Return**

#### 4. End of Day
1. After completing all deliveries, go to **End of Day**
2. Select your route
3. Complete end-of-day safety checklist
4. Submit final report

### Mobile Optimization
The driver interface is optimized for mobile devices:
- Touch-friendly buttons
- Large tap targets
- Simplified navigation
- Camera integration for photos

## Common Tasks

### Uploading a New Route
1. **Admin**: Prepare Excel file with route data
2. **Admin**: Upload via Routes → Upload Route
3. **System**: Automatically creates driver accounts if needed
4. **Driver**: Receives route assignment
5. **Driver**: Completes safety check to activate route

### Processing a Delivery
1. **Driver**: Sets status to "On the Way"
2. **Driver**: Updates to "Arrived" at customer location
3. **Driver**: Completes delivery and uploads invoice
4. **Driver**: Adds returns if necessary
5. **Driver**: Marks delivery as "Completed"
6. **System**: Sends confirmation email to customer
7. **Admin**: Monitors progress in real-time

### Handling Issues
1. **Driver**: Adds notes to problematic deliveries
2. **Admin**: Reviews notes and takes action
3. **Admin**: Can add administrative notes visible to drivers
4. **System**: Tracks all communications for reference

## Troubleshooting

### Login Issues
- **Problem**: Cannot log in
- **Solution**: 
  - Verify username and password
  - Check if account exists
  - Contact administrator for password reset

### Route Not Showing
- **Problem**: Driver cannot see assigned route
- **Solution**:
  - Verify route was uploaded correctly
  - Check if driver name matches exactly
  - Ensure route date is correct

### Photo Upload Issues
- **Problem**: Cannot upload invoice photos
- **Solution**:
  - Check internet connection
  - Ensure camera permissions are enabled
  - Try refreshing the page
  - Use a different browser if needed

### Email Not Sending
- **Problem**: Customer confirmation emails not sending
- **Solution**:
  - Verify customer email address
  - Check email configuration
  - Manually resend from stop details
  - Contact system administrator

### Performance Issues
- **Problem**: System running slowly
- **Solution**:
  - Clear browser cache
  - Check internet connection
  - Close unnecessary browser tabs
  - Contact administrator if issues persist

### Real-time Updates Not Working
- **Problem**: Status changes not appearing immediately
- **Solution**:
  - Refresh the page
  - Check internet connection
  - Verify WebSocket connection
  - Contact administrator if issues persist

## Support

For technical support or questions:
1. Check this user guide first
2. Contact your system administrator
3. Report bugs or issues with detailed descriptions
4. Include screenshots when possible

## System Maintenance

### Regular Tasks
- **Daily**: Monitor route uploads and completions
- **Weekly**: Review safety check compliance
- **Monthly**: Export data for reporting
- **As needed**: Add new customers and drivers

### Data Backup
- System data is automatically backed up
- Export important data regularly
- Keep local copies of route files

## Security

### Best Practices
- Use strong passwords
- Log out when finished
- Don't share login credentials
- Report suspicious activity
- Keep browser updated

### Data Privacy
- Customer information is protected
- Access is role-based
- All actions are logged
- Data is encrypted in transit
