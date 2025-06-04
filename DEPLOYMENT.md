# 🚀 B&R Driver App - Zero-Downtime Deployment

Simple deployment solution that works with your existing PM2 + git clone workflow, **without killing your running application**.

## ⚡ Quick Setup (2 Minutes)

### 1. Configure Deployment (One Time)
```bash
npm run deploy:configure
```

This will ask for:
- Your git repository URL
- VPS username and IP
- App directory path on server
- PM2 app name

### 2. Deploy Your Changes
```bash
npm run deploy
```

That's it! Your application will be updated with **zero downtime**.

## 🔄 How It Works

The deployment process:

1. **Commits and pushes** your local changes to git
2. **Clones fresh code** to a temporary directory on your VPS
3. **Installs dependencies** and builds the application
4. **Runs database migrations** (preserves your data)
5. **Preserves your uploads** and environment files
6. **Atomically swaps** the old app with the new one
7. **Reloads PM2** with zero downtime (`pm2 reload` instead of restart)
8. **Runs health checks** and automatically rolls back if anything fails

## ✅ What's Preserved

- ✅ **Database** - Migrations run safely, data is never lost
- ✅ **Uploads** - All files in `public/uploads/` are preserved
- ✅ **Environment** - Your `.env.production` or `.env` file is preserved
- ✅ **PM2 Configuration** - Your existing PM2 setup continues working
- ✅ **Zero Downtime** - Users never experience downtime

## 🛠️ Manual Server Update

If you prefer to update directly on the server:

```bash
# Copy the update script to your server (first time only)
scp update-server.sh your_user@your_server_ip:/path/to/your/app/

# SSH into your server and run the update
ssh your_user@your_server_ip
cd /path/to/your/app
./update-server.sh
```

## 📁 Files Created

- `update-server.sh` - Zero-downtime update script (runs on your VPS)
- `deploy-to-server.sh` - Local deployment helper
- `configure-deployment.sh` - One-time configuration script
- `DEPLOYMENT.md` - This documentation

## 🔧 Typical Workflow

```bash
# 1. Make your code changes locally
# 2. Test locally
npm run dev

# 3. Deploy to production (commits, pushes, and updates server)
npm run deploy
```

## 🚨 Rollback Protection

If anything goes wrong during deployment:
- ✅ **Automatic health check** after deployment
- ✅ **Automatic rollback** if health check fails
- ✅ **Backup created** before each deployment
- ✅ **Database preserved** even during rollbacks

## 💡 Benefits

- ✅ **Zero Downtime** - Uses `pm2 reload` instead of restart
- ✅ **Safe** - Automatic rollback if anything fails
- ✅ **Simple** - Works with your existing PM2 + git workflow
- ✅ **Fast** - Only rebuilds what's necessary
- ✅ **Preserves Data** - Database, uploads, and config are safe

## 🔍 Troubleshooting

### Check PM2 Status
```bash
ssh your_user@your_server_ip 'pm2 status'
```

### View Application Logs
```bash
ssh your_user@your_server_ip 'pm2 logs br-driver-app'
```

### Manual PM2 Reload
```bash
ssh your_user@your_server_ip 'pm2 reload br-driver-app'
```

### Check Health Endpoint
```bash
curl http://your_server_ip:3000/api/health
```

## 🎯 Why This Approach?

This solution is designed specifically for your workflow:
- ✅ **No complex CI/CD** - Simple scripts that work
- ✅ **Uses your existing PM2 setup** - No changes needed
- ✅ **Git-based** - Works with your current git clone approach
- ✅ **Zero downtime** - Never kills your running application
- ✅ **Safe** - Automatic rollback protection
- ✅ **Fast** - Optimized for quick deployments

Perfect for internal applications where you need reliability without complexity!
