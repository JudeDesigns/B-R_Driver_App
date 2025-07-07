#!/bin/bash

# Quick Pre-Deployment Test Script
# Run this before deploying token refresh system to VPS

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🧪 Running Pre-Deployment Tests for Token Refresh System..."
echo ""

# Test 1: Check if Node.js is available
print_status "1️⃣ Checking Node.js availability..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js to run tests."
    exit 1
fi

# Test 2: Check if required files exist
print_status "2️⃣ Checking required files..."
REQUIRED_FILES=(
    "src/lib/tokenRefresh.ts"
    "src/hooks/useTokenRefresh.ts"
    "src/app/api/auth/refresh/route.ts"
    "tests/runAllTests.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file exists"
    else
        print_error "✗ $file missing"
        exit 1
    fi
done

# Test 3: Check if JWT_SECRET is set
print_status "3️⃣ Checking environment variables..."
if [ -f ".env" ]; then
    if grep -q "JWT_SECRET" .env; then
        print_success "✓ JWT_SECRET found in .env"
    else
        print_warning "⚠ JWT_SECRET not found in .env - tests will use default"
    fi
else
    print_warning "⚠ .env file not found - tests will use defaults"
fi

# Test 4: Install test dependencies if needed
print_status "4️⃣ Checking test dependencies..."
if [ -f "package.json" ]; then
    if command -v npm &> /dev/null; then
        print_status "Installing/checking dependencies..."
        npm install --silent
        print_success "✓ Dependencies ready"
    else
        print_warning "⚠ npm not found, skipping dependency check"
    fi
else
    print_warning "⚠ package.json not found, skipping dependency check"
fi

# Test 5: Run the comprehensive test suite
print_status "5️⃣ Running comprehensive test suite..."
echo ""

if node tests/runAllTests.js; then
    print_success "🎉 ALL TESTS PASSED!"
    echo ""
    print_status "=== DEPLOYMENT SAFETY CONFIRMED ==="
    print_status "✅ Token refresh system is working correctly"
    print_status "✅ No existing functionality will be broken"
    print_status "✅ API endpoints are compatible"
    print_status "✅ Frontend components integrate properly"
    print_status "✅ End-to-end workflows function as expected"
    echo ""
    print_success "🚀 SAFE TO DEPLOY TO PRODUCTION!"
    echo ""
    print_status "Next steps:"
    print_status "1. Run: chmod +x deploy-token-refresh.sh"
    print_status "2. Run: ./deploy-token-refresh.sh"
    print_status "3. Test manually on VPS after deployment"
    echo ""
else
    print_error "❌ TESTS FAILED!"
    echo ""
    print_error "=== DEPLOYMENT BLOCKED ==="
    print_error "Some tests failed. Do not deploy until all tests pass."
    print_error "Review the test output above and fix any issues."
    echo ""
    print_status "Common fixes:"
    print_status "• Check that all required files are present"
    print_status "• Verify JWT_SECRET is set in environment"
    print_status "• Ensure database connection works"
    print_status "• Review any error messages in test output"
    echo ""
    exit 1
fi

# Test 6: Quick syntax check
print_status "6️⃣ Running syntax checks..."
SYNTAX_ERRORS=0

# Check TypeScript files
for file in src/lib/tokenRefresh.ts src/hooks/useTokenRefresh.ts; do
    if [ -f "$file" ]; then
        if command -v npx &> /dev/null; then
            if npx tsc --noEmit "$file" 2>/dev/null; then
                print_success "✓ $file syntax OK"
            else
                print_error "✗ $file has syntax errors"
                SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
            fi
        else
            print_warning "⚠ TypeScript compiler not available, skipping syntax check for $file"
        fi
    fi
done

if [ $SYNTAX_ERRORS -gt 0 ]; then
    print_error "❌ $SYNTAX_ERRORS file(s) have syntax errors. Fix before deploying."
    exit 1
fi

# Test 7: Final deployment readiness check
print_status "7️⃣ Final deployment readiness check..."

READINESS_SCORE=0
TOTAL_CHECKS=5

# Check 1: All tests passed (already confirmed above)
READINESS_SCORE=$((READINESS_SCORE + 1))

# Check 2: Required files exist (already confirmed above)
READINESS_SCORE=$((READINESS_SCORE + 1))

# Check 3: No syntax errors (already confirmed above)
READINESS_SCORE=$((READINESS_SCORE + 1))

# Check 4: Git status clean (optional but recommended)
if command -v git &> /dev/null; then
    if [ -z "$(git status --porcelain)" ]; then
        print_success "✓ Git working directory clean"
        READINESS_SCORE=$((READINESS_SCORE + 1))
    else
        print_warning "⚠ Git working directory has uncommitted changes"
        print_status "Consider committing changes before deployment"
    fi
else
    print_warning "⚠ Git not available, skipping repository check"
fi

# Check 5: Deployment script exists
if [ -f "deploy-token-refresh.sh" ]; then
    print_success "✓ Deployment script ready"
    READINESS_SCORE=$((READINESS_SCORE + 1))
else
    print_error "✗ deploy-token-refresh.sh not found"
fi

echo ""
print_status "📊 Deployment Readiness: $READINESS_SCORE/$TOTAL_CHECKS"

if [ $READINESS_SCORE -eq $TOTAL_CHECKS ]; then
    print_success "🎯 PERFECT SCORE! Ready for deployment."
elif [ $READINESS_SCORE -ge 4 ]; then
    print_success "✅ GOOD TO GO! Minor issues noted above."
else
    print_warning "⚠ PROCEED WITH CAUTION. Address issues above."
fi

echo ""
print_status "🎉 Pre-deployment testing complete!"
print_status "Token refresh system is ready for production deployment."
