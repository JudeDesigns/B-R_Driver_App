# Quick Test Guide - Credit Memo Email Fix

## Run All Tests

```bash
# Run both unit and integration tests
node tests/email-subject-credit-memo.test.js && node tests/email-api-integration.test.js
```

## Expected Results

✅ **12/12 tests should pass (100%)**

- 8 unit tests
- 4 integration tests

## Test What Was Fixed

### The Problem
Email subject line was missing credit memo information:
```
❌ BEFORE: Delivery Completed - Customer - Order #INV-123 $500.00
```

### The Solution
Email subject line now includes credit memo when present:
```
✅ AFTER: Delivery Completed - Customer - Order #INV-123 $500.00 | Credit Memo #CM-456 $50.00
```

## Manual Testing in Production

### Test Case 1: Stop WITH Credit Memo

1. Go to a stop that has a credit memo uploaded
2. Click "Send Email" button
3. Check the email subject line
4. **Expected:** Subject includes `| Credit Memo #[NUMBER] $[AMOUNT]`

### Test Case 2: Stop WITHOUT Credit Memo

1. Go to a stop that does NOT have a credit memo
2. Click "Send Email" button
3. Check the email subject line
4. **Expected:** Subject does NOT include credit memo section

### Test Case 3: Bulk Route Emails

1. Go to a route with multiple stops (some with credit memos, some without)
2. Click "Send All Emails" button
3. Check the email subject lines
4. **Expected:** 
   - Stops with credit memos have credit memo in subject
   - Stops without credit memos do NOT have credit memo in subject

## Files Changed

1. `src/app/api/admin/stops/[id]/send-email/route.ts`
2. `src/app/api/admin/routes/[id]/send-emails/route.ts`

## Test Files Created

1. `tests/email-subject-credit-memo.test.js` - Unit tests
2. `tests/email-api-integration.test.js` - Integration tests
3. `tests/EMAIL_CREDIT_MEMO_TEST_RESULTS.md` - Test documentation
4. `CREDIT_MEMO_EMAIL_FIX_SUMMARY.md` - Complete summary

## Quick Verification

```bash
# Build the app
npm run build

# Should complete with no errors
```

## Deployment

```bash
git pull origin main
npm install
npm run build
pm2 restart all
```

## Support for Multiple Credit Memos

The system supports multiple credit memos by concatenating them:

**Example:**
```
Credit Memo #CM-001, CM-002 $150.00
```

Just enter multiple credit memo numbers separated by commas in the credit memo number field.

## Edge Cases Handled

✅ No credit memo - Works normally
✅ Missing credit memo number - No credit memo in subject
✅ Missing credit memo amount - No credit memo in subject
✅ Zero credit memo amount - No credit memo in subject
✅ Multiple credit memos - All numbers shown in subject
✅ Special characters in customer name - Works correctly
✅ Large amounts - Formatted correctly

## Questions?

See `CREDIT_MEMO_EMAIL_FIX_SUMMARY.md` for complete details.

