# Production Database Scripts

This directory contains scripts for managing the production database.

---

## 📋 **Available Scripts**

### 1. **Create SuperAdmin User** ⭐

**Script:** `create-superadmin.sh`

**Purpose:** Interactively create a new SuperAdmin user with secure credentials.

**Usage:**
```bash
bash create-superadmin.sh
```

**Features:**
- ✅ Interactive prompts for username, password, and full name
- ✅ Checks if username already exists
- ✅ Password confirmation
- ✅ Minimum 8 character password requirement
- ✅ Automatically hashes password with bcrypt
- ✅ Creates user with SUPER_ADMIN role

**Example:**
```bash
$ bash create-superadmin.sh

Step 1: Username
Enter username: john.admin
✓ Username 'john.admin' is available

Step 2: Password
Enter password: ********
Confirm password: ********
✓ Password confirmed

Step 3: Full Name
Enter full name: John Administrator
✓ Full name: John Administrator

Create this SuperAdmin user? (yes/no): yes

✓ SuperAdmin User Created Successfully!
```

---

### 2. **Fix Customer Email Constraint**

**Script:** `force-fix-email-constraint.sh`

**Purpose:** Fix the customer email unique constraint to allow multiple empty emails.

**Usage:**
```bash
bash force-fix-email-constraint.sh
pm2 restart br-driver-app
```

**What it fixes:**
- ✅ Removes old unique constraint on `customers.email`
- ✅ Creates partial unique index (allows multiple empty emails)
- ✅ Actual email addresses must still be unique

---

### 3. **Fix system_documents Table**

**Script:** `fix-system-documents-table.sh`

**Purpose:** Fix the system_documents table structure (adds missing columns).

**Usage:**
```bash
bash fix-system-documents-table.sh
pm2 restart br-driver-app
```

**What it fixes:**
- ✅ Drops broken `system_documents` table
- ✅ Recreates with all 15 required columns
- ✅ Recreates foreign key constraints

---

### 4. **Fix All Production Issues**

**Script:** `fix-all-production-issues.sh`

**Purpose:** Master script that runs all database fixes at once.

**Usage:**
```bash
bash fix-all-production-issues.sh
pm2 restart br-driver-app
```

**What it fixes:**
- ✅ Customer email constraint
- ✅ system_documents table structure
- ✅ document_acknowledgments table
- ✅ Regenerates Prisma client

---

### 5. **Check system_documents Table**

**Script:** `check-system-documents-table.sh`

**Purpose:** Diagnostic script to check system_documents table structure.

**Usage:**
```bash
bash check-system-documents-table.sh
```

**Shows:**
- Table structure
- Column list
- Row count
- Enum types

---

### 6. **Deploy Migrations Safely**

**Script:** `deploy-safe.sh`

**Purpose:** Smart deployment script that checks what exists before applying migrations.

**Usage:**
```bash
bash deploy-safe.sh
```

**Features:**
- ✅ Checks if tables/columns already exist
- ✅ Only applies needed migrations
- ✅ Marks already-applied migrations
- ✅ Safe to run multiple times

---

## 🚀 **Common Workflows**

### **Initial Production Setup**

```bash
# 1. Deploy migrations
bash deploy-safe.sh

# 2. Fix any issues
bash fix-all-production-issues.sh

# 3. Create SuperAdmin user
bash create-superadmin.sh

# 4. Restart application
pm2 restart br-driver-app
```

### **Create Additional SuperAdmin**

```bash
bash create-superadmin.sh
```

### **Fix Customer Update Errors**

```bash
bash force-fix-email-constraint.sh
pm2 restart br-driver-app
```

### **Fix System Documents Errors**

```bash
bash fix-system-documents-table.sh
pm2 restart br-driver-app
```

---

## ⚠️ **Important Notes**

1. **Always restart the application** after running database fixes:
   ```bash
   pm2 restart br-driver-app
   ```

2. **All scripts are configured for production**:
   - Database: `br_food_services`
   - User: `br_user`

3. **Scripts are safe to run multiple times** - They check before making changes

4. **Backup before major changes** (optional but recommended):
   ```bash
   pg_dump -U br_user -d br_food_services > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

---

## 🔐 **Security Best Practices**

### **SuperAdmin Credentials:**
- ✅ Use strong passwords (minimum 8 characters, mix of uppercase, lowercase, numbers, symbols)
- ✅ Store credentials in a secure password manager
- ✅ Do NOT share credentials
- ✅ Change passwords regularly
- ✅ Use SuperAdmin account only for administrative tasks

### **Database Access:**
- ✅ Keep database credentials secure
- ✅ Use SSH keys for server access
- ✅ Limit database access to necessary users only

---

## 📞 **Support**

If you encounter issues:
1. Check the logs: `pm2 logs br-driver-app --lines 50`
2. Verify database connection: `psql -U br_user -d br_food_services -c "SELECT 1;"`
3. Check Prisma client: `npx prisma generate`

---

**All scripts are production-ready and safe to use!** 🚀

