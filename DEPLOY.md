# Deployment Guide for AlmaLinux 8

This guide describes how to deploy the B&R Driver App on an AlmaLinux 8 server.

## Prerequisites

Since you already have **Node.js** and **PM2** installed, you need to set up the database and web server.

### 1. Install PostgreSQL on AlmaLinux 8

Enable the PostgreSQL module and install the server:
```bash
sudo dnf module disable postgresql -y
sudo dnf module enable postgresql:15 -y
sudo dnf install -y postgresql-server postgresql-contrib
```

Initialize the database:
```bash
sudo postgresql-setup --initdb
```

**CRITICAL: Configure Authentication**
By default, AlmaLinux blocks password login. You must change `ident` to `md5` (or `scram-sha-256`) in `pg_hba.conf`.

1.  Open the configuration file:
    ```bash
    sudo nano /var/lib/pgsql/data/pg_hba.conf
    ```
2.  Find the lines for IPv4 and IPv6 local connections (near the bottom). Change `ident` to `md5`:
    ```text
    # IPv4 local connections:
    host    all             all             127.0.0.1/32            md5
    # IPv6 local connections:
    host    all             all             ::1/128                 md5
    ```
3.  Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

Start and enable the service:
```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2. Configure PostgreSQL

Create a database and user for the application:
```bash
# Switch to postgres user
sudo -i -u postgres

# Enter PostgreSQL prompt
psql
```

Run the following SQL commands (replace `password` with a strong password):
```sql
CREATE DATABASE br_food_services;
CREATE USER br_user WITH ENCRYPTED PASSWORD 'BRFOODSERVICES156800';
GRANT ALL PRIVILEGES ON DATABASE br_food_services TO br_user;
-- Grant schema usage for Prisma
ALTER DATABASE br_food_services OWNER TO br_user;
\q
```

Exit the postgres user session:
```bash
exit
```

### 3. Install Nginx (Web Server)

To make your app accessible via a domain or IP (port 80):
```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Fresh Installation Steps

Follow these steps to install the application from scratch:

1.  **Clone the Repository**:
    ```bash
    # Go to your desired directory (e.g., /var/www or home folder)
    cd ~
    git clone <your-repo-url>
    cd B-R_Driver_App
    ```

2.  **Setup Environment Variables**:
    Create the `.env` file:
    ```bash
    cp .env.example .env
    nano .env
    ```
    **Crucial**: Update `DATABASE_URL` to match the user/password you created in Step 2.
    ```env
    DATABASE_URL="postgresql://br_user:BRFOODSERVICES156800@localhost:5432/br_food_services"
    JWT_SECRET="generate-a-random-secret-here"
    NEXT_PUBLIC_API_URL="http://your-server-ip-or-domain/api"
    ```

3.  **Run Deployment**:
    Since you have PM2 and Node installed, you can simply run:
    ```bash
    chmod +x deploy-to-server.sh
    ./deploy-to-server.sh
    ```
    *This script will install dependencies, build the app, set up the database schema, and start the server.*

4.  **Verify**:
    Check if the app is running:
    ```bash
    pm2 status
    pm2 logs br-driver-app
    ```

5.  **Configure Nginx (Reverse Proxy)**:
    Create the configuration file to make the app accessible on port 80:
    ```bash
    sudo vim /etc/nginx/conf.d/br-driver-app.conf
    ```
    Paste the following (replace `your-domain.com` with your IP or domain):
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
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
    Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

    Test and reload:
    ```bash
    sudo nginx -t
    sudo systemctl reload nginx
    ```
    *Now you should be able to access your app at `http://your-server-ip`.*

## Deployment

To deploy the application (build, migrate, and start/restart):

### Option 1: Deploy Latest Version
This pulls the latest code from the `main` branch.
```bash
./deploy-to-server.sh
```

### Option 2: Deploy Specific Version
You can deploy a specific git tag, branch, or commit hash.
```bash
./deploy-to-server.sh v1.0.0
# OR
./deploy-to-server.sh develop
```

## Nginx Configuration

Create a new Nginx configuration file:

```bash
sudo nano /etc/nginx/conf.d/br-driver-app.conf
```

Add the following content (replace `your-domain.com` with your actual domain):

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
        proxy_cache_bypass $http_upgrade;
    }
}
```

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Setup (Optional but Recommended)

Install Certbot and enable HTTPS:

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d delivery.brfood.us
```

## Monitoring

- View logs: `pm2 logs br-driver-app`
- Monitor status: `pm2 status`
