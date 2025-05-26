# B&R Food Services - Deployment Guide

## Prerequisites

### System Requirements
- Node.js 18+ 
- PostgreSQL 14+
- 2GB RAM minimum (4GB recommended)
- 10GB disk space minimum

### Required Services
- Database (PostgreSQL)
- Email service (SMTP)
- File storage (local or cloud)

## Environment Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/brfoodservices"

# JWT Secret (generate a secure random string)
JWT_SECRET="your-super-secure-jwt-secret-key-here"

# Email Configuration
EMAIL_HOST="smtp.your-email-provider.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@domain.com"
EMAIL_PASS="your-email-password"
EMAIL_FROM="noreply@brfoodservices.com"
EMAIL_SECURE="false"

# Application
NODE_ENV="production"
PORT="3000"

# File Upload
MAX_FILE_SIZE="10485760"  # 10MB
UPLOAD_DIR="./uploads"

# Socket.IO
SOCKET_PORT="3001"
```

### Production Environment Variables

For production, ensure these additional settings:

```bash
# Security
SECURE_COOKIES="true"
TRUST_PROXY="true"

# Performance
NODE_OPTIONS="--max-old-space-size=2048"

# Logging
LOG_LEVEL="error"
```

## Database Setup

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**CentOS/RHEL:**
```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database

```bash
sudo -u postgres psql
CREATE DATABASE brfoodservices;
CREATE USER brfoodservices_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE brfoodservices TO brfoodservices_user;
\q
```

### 3. Run Migrations

```bash
npm run prisma:migrate
npm run db:seed
```

## Application Deployment

### Option 1: Traditional Server Deployment

#### 1. Clone Repository
```bash
git clone <repository-url>
cd office_project
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Build Application
```bash
npm run build
```

#### 4. Start Application
```bash
npm start
```

#### 5. Process Manager (PM2)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'brfoodservices',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/brfoodservices
    depends_on:
      - db
    volumes:
      - ./uploads:/app/uploads

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=brfoodservices
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

#### 3. Deploy
```bash
docker-compose up -d
```

### Option 3: Vercel Deployment

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Configure vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "DATABASE_URL": "@database_url",
    "JWT_SECRET": "@jwt_secret"
  }
}
```

#### 3. Deploy
```bash
vercel --prod
```

## Reverse Proxy Setup (Nginx)

### 1. Install Nginx
```bash
sudo apt install nginx
```

### 2. Configure Nginx
Create `/etc/nginx/sites-available/brfoodservices`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/brfoodservices /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL Certificate (Let's Encrypt)

### 1. Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

### 2. Obtain Certificate
```bash
sudo certbot --nginx -d your-domain.com
```

### 3. Auto-renewal
```bash
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Logging

### 1. Application Logs
```bash
# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f

# System logs
sudo journalctl -u nginx -f
```

### 2. Health Checks
Create a health check endpoint and monitor it:

```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:3000/api/health || echo "Health check failed" | mail -s "App Down" admin@domain.com
```

### 3. Database Monitoring
```bash
# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Connection monitoring
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

## Backup Strategy

### 1. Database Backup
```bash
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U brfoodservices_user brfoodservices > backup_$DATE.sql
gzip backup_$DATE.sql

# Keep only last 7 days
find . -name "backup_*.sql.gz" -mtime +7 -delete
```

### 2. File Backup
```bash
#!/bin/bash
# backup-files.sh
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf uploads_backup_$DATE.tar.gz uploads/
find . -name "uploads_backup_*.tar.gz" -mtime +30 -delete
```

### 3. Automated Backups
```bash
# Add to crontab
0 2 * * * /path/to/backup-db.sh
0 3 * * * /path/to/backup-files.sh
```

## Security Considerations

### 1. Firewall Configuration
```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Database Security
- Use strong passwords
- Limit database connections
- Enable SSL for database connections
- Regular security updates

### 3. Application Security
- Keep dependencies updated
- Use HTTPS in production
- Implement rate limiting
- Regular security audits

## Performance Optimization

### 1. Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_routes_date ON routes(date);
CREATE INDEX idx_stops_status ON stops(status);
CREATE INDEX idx_stops_route_id ON stops(route_id);
```

### 2. Application Optimization
- Enable gzip compression
- Use CDN for static assets
- Implement caching
- Optimize database queries

### 3. Server Optimization
```bash
# Increase file limits
echo "fs.file-max = 65536" >> /etc/sysctl.conf

# Optimize PostgreSQL
# Edit /etc/postgresql/14/main/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL
   - Verify PostgreSQL is running
   - Check firewall settings

2. **Email Not Sending**
   - Verify SMTP settings
   - Check email provider restrictions
   - Test with telnet

3. **File Upload Issues**
   - Check disk space
   - Verify upload directory permissions
   - Check MAX_FILE_SIZE setting

4. **Performance Issues**
   - Monitor CPU and memory usage
   - Check database query performance
   - Review application logs

### Log Locations
- Application: PM2 logs or Docker logs
- Nginx: `/var/log/nginx/`
- PostgreSQL: `/var/log/postgresql/`
- System: `journalctl`

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate logs weekly
- Monitor disk space daily
- Test backups monthly
- Security updates as needed

### Update Procedure
1. Backup database and files
2. Test updates in staging environment
3. Schedule maintenance window
4. Deploy updates
5. Verify functionality
6. Monitor for issues
