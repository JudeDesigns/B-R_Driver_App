# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Fill in all required environment variables
- [ ] Ensure JWT_SECRET is at least 32 characters long
- [ ] Verify DATABASE_URL points to production database
- [ ] Test database connectivity

### 2. Security Verification
- [ ] All console.log statements are wrapped with NODE_ENV checks
- [ ] JWT_SECRET is secure and unique
- [ ] Database credentials are secure
- [ ] No development secrets in production environment
- [ ] HTTPS is configured (recommended)

### 3. Database Preparation
- [ ] Production database is created
- [ ] Database migrations are applied: `npm run prisma:migrate`
- [ ] Database is seeded if needed: `npm run db:seed`
- [ ] Database backups are configured

### 4. Build Verification
- [ ] TypeScript compilation passes: `npm run build`
- [ ] ESLint checks pass: `npm run lint`
- [ ] All tests pass (if applicable)
- [ ] No build warnings or errors

## Deployment Steps

### Option 1: VPS Deployment with PM2

1. **Install Dependencies**
   ```bash
   npm ci --production
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Setup Database**
   ```bash
   npm run db:setup
   ```

4. **Start with PM2**
   ```bash
   npm run deploy:start
   ```

### Option 2: Docker Deployment

1. **Build Docker Image**
   ```bash
   docker build -t br-driver-app .
   ```

2. **Run Container**
   ```bash
   docker run -d \
     --name br-driver-app \
     -p 3000:3000 \
     --env-file .env.production \
     br-driver-app
   ```

### Option 3: Manual Deployment

1. **Install Dependencies**
   ```bash
   npm ci
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Setup Database**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start Application**
   ```bash
   npm start
   ```

## Post-Deployment Verification

### 1. Health Checks
- [ ] Application starts without errors
- [ ] Database connection is successful
- [ ] WebSocket connections work
- [ ] Login functionality works
- [ ] Admin dashboard loads
- [ ] Driver interface loads

### 2. Performance Checks
- [ ] Page load times are acceptable
- [ ] Database queries are optimized
- [ ] Memory usage is within limits
- [ ] CPU usage is reasonable

### 3. Security Checks
- [ ] HTTPS is working (if configured)
- [ ] No sensitive data in logs
- [ ] Authentication is working
- [ ] Authorization is enforced
- [ ] Rate limiting is active

## Monitoring and Maintenance

### 1. Log Monitoring
- Check application logs: `npm run deploy:logs`
- Monitor error rates
- Watch for security events

### 2. Database Monitoring
- Monitor connection pool usage
- Check query performance
- Verify backup integrity

### 3. Performance Monitoring
- Monitor response times
- Check memory usage
- Monitor CPU utilization

## Troubleshooting

### Common Issues

1. **Environment Variable Errors**
   - Verify all required variables are set
   - Check variable names and values
   - Ensure JWT_SECRET meets requirements

2. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check database server status
   - Verify network connectivity

3. **Build Failures**
   - Check TypeScript errors
   - Verify all dependencies are installed
   - Check for missing environment variables

4. **Runtime Errors**
   - Check application logs
   - Verify database migrations
   - Check file permissions

### Emergency Procedures

1. **Application Restart**
   ```bash
   npm run deploy:restart
   ```

2. **Application Stop**
   ```bash
   npm run deploy:stop
   ```

3. **Database Rollback**
   - Restore from latest backup
   - Apply necessary migrations

## Security Considerations

1. **Regular Updates**
   - Keep dependencies updated
   - Apply security patches
   - Monitor for vulnerabilities

2. **Access Control**
   - Limit server access
   - Use strong passwords
   - Enable two-factor authentication

3. **Data Protection**
   - Regular database backups
   - Encrypt sensitive data
   - Secure file uploads

4. **Monitoring**
   - Set up error tracking
   - Monitor security events
   - Regular security audits
