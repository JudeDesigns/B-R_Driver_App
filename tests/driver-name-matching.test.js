/**
 * Driver Name Matching Tests
 *
 * Tests for the driver name resolution logic introduced in routeParser.ts.
 * These tests run in isolation — no database, no Next.js required.
 *
 * Run with: node tests/driver-name-matching.test.js
 *
 * What is being tested:
 *   1. Trimming of whitespace from CSV driver names
 *   2. Case-insensitive matching against driver.username
 *   3. Case-insensitive matching against driver.fullName
 *   4. Canonical username is stored (not raw CSV string or fullName)
 *   5. Unmatched names are collected and returned correctly
 *   6. Stops are rewritten to canonical username when a match is found
 *   7. Stops are kept as-is (trimmed) when no match is found
 *   8. Multiple drivers in the same CSV all resolve correctly
 *   9. The safety-check / assigned-routes OR query pattern still works
 *      after our canonical rewrite (username match branch always fires)
 */

// ─── Reproduce the exact logic from routeParser.ts saveRouteToDatabase ────────

/**
 * Resolves CSV driver names against known driver accounts.
 * Mirrors the logic at routeParser.ts ~line 545–620.
 *
 * @param {Array<{id:string, username:string, fullName:string|null}>} allDriverUsers
 * @param {Array<{driverName:string}>} stops  (mutated in-place like the real code)
 * @returns {{ csvToCanonical: Map, unmatchedDriverNames: string[] }}
 */
function resolveDriverNames(allDriverUsers, stops) {
  // Step 1: collect unique driver name strings from stops (already trimmed)
  const driverNamesSet = new Set();
  for (const stop of stops) {
    if (stop.driverName) driverNamesSet.add(stop.driverName);
  }
  const csvDriverNames = Array.from(driverNamesSet);

  // Step 2: build lookup: lowercased key → canonical username
  const driverLookup = new Map();
  for (const u of allDriverUsers) {
    driverLookup.set(u.username.toLowerCase(), u.username);
    if (u.fullName) {
      driverLookup.set(u.fullName.toLowerCase(), u.username);
    }
  }

  // Step 3: map each CSV name to canonical username or null
  const csvToCanonical = new Map();
  const unmatchedDriverNames = [];

  for (const csvName of csvDriverNames) {
    const canonical = driverLookup.get(csvName.toLowerCase()) ?? null;
    csvToCanonical.set(csvName, canonical);
    if (!canonical) unmatchedDriverNames.push(csvName);
  }

  // Step 4: rewrite stop.driverName to canonical username where possible
  for (const stop of stops) {
    const canonical = csvToCanonical.get(stop.driverName);
    if (canonical) stop.driverName = canonical;
    // if null, keep trimmed CSV string unchanged
  }

  return { csvToCanonical, unmatchedDriverNames };
}

/**
 * Mirrors the trim step at routeParser.ts ~line 307:
 * const rawDriverName = row[columnIndices.driver]?.toString().trim() || "";
 */
function trimDriverName(raw) {
  return raw?.toString().trim() || '';
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failures.push({ name, error: err.message });
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) throw new Error(`Expected ${e}, got ${a}`);
    },
    toContain(item) {
      if (!actual.includes(item)) {
        throw new Error(`Expected array/string to contain ${JSON.stringify(item)}, got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(n) {
      if (actual.length !== n) {
        throw new Error(`Expected length ${n}, got ${actual.length}`);
      }
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    not: {
      toContain(item) {
        if (actual.includes(item)) {
          throw new Error(`Expected array/string NOT to contain ${JSON.stringify(item)}`);
        }
      },
    },
  };
}

// ─── Test data ────────────────────────────────────────────────────────────────

const DRIVER_RAUL    = { id: '1', username: 'Raul',  fullName: 'Raul Gonzalez' };
const DRIVER_MARIO   = { id: '2', username: 'Mario', fullName: 'Mario Lopez' };
const DRIVER_MOISES  = { id: '3', username: 'Moises', fullName: 'Moises Aguiar' };
const ALL_DRIVERS    = [DRIVER_RAUL, DRIVER_MARIO, DRIVER_MOISES];

// ─── Suite 1: Trim logic ──────────────────────────────────────────────────────

console.log('\n📋 Suite 1: CSV name trimming');

test('exact match — no whitespace', () => {
  expect(trimDriverName('Raul')).toBe('Raul');
});

test('trims trailing space', () => {
  expect(trimDriverName('Raul ')).toBe('Raul');
});

test('trims leading space', () => {
  expect(trimDriverName(' Raul')).toBe('Raul');
});

test('trims both sides', () => {
  expect(trimDriverName('  Raul  ')).toBe('Raul');
});

test('handles null/undefined gracefully', () => {
  expect(trimDriverName(null)).toBe('');
  expect(trimDriverName(undefined)).toBe('');
});

test('handles tab characters', () => {
  expect(trimDriverName('\tRaul\t')).toBe('Raul');
});

// ─── Suite 2: Case-insensitive username matching ───────────────────────────────

console.log('\n📋 Suite 2: Case-insensitive username matching');

test('exact case username match', () => {
  const stops = [{ driverName: 'Raul' }];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(csvToCanonical.get('Raul')).toBe('Raul');
});

test('lowercase CSV matches title-case username', () => {
  const stops = [{ driverName: 'raul' }];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(csvToCanonical.get('raul')).toBe('Raul');
});

test('uppercase CSV matches title-case username', () => {
  const stops = [{ driverName: 'RAUL' }];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(csvToCanonical.get('RAUL')).toBe('Raul');
});

test('mixed case CSV matches username', () => {
  const stops = [{ driverName: 'rAuL' }];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(csvToCanonical.get('rAuL')).toBe('Raul');
});

// ─── Suite 3: fullName matching ───────────────────────────────────────────────

console.log('\n📋 Suite 3: fullName matching');

test('exact fullName match resolves to username', () => {
  const stops = [{ driverName: 'Raul Gonzalez' }];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(csvToCanonical.get('Raul Gonzalez')).toBe('Raul');
});

test('lowercase fullName resolves to username', () => {
  const stops = [{ driverName: 'raul gonzalez' }];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(csvToCanonical.get('raul gonzalez')).toBe('Raul');
});

test('uppercase fullName resolves to username', () => {
  const stops = [{ driverName: 'MARIO LOPEZ' }];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(csvToCanonical.get('MARIO LOPEZ')).toBe('Mario');
});

test('driver with no fullName still matches by username', () => {
  const driversNoFullName = [{ id: '1', username: 'Raul', fullName: null }];
  const stops = [{ driverName: 'Raul' }];
  const { csvToCanonical } = resolveDriverNames(driversNoFullName, stops);
  expect(csvToCanonical.get('Raul')).toBe('Raul');
});

// ─── Suite 4: Stop driverName rewrite ─────────────────────────────────────────

console.log('\n📋 Suite 4: Stop driverName rewrite to canonical username');

test('stop.driverName is rewritten to canonical username on exact match', () => {
  const stops = [{ driverName: 'Raul' }];
  resolveDriverNames(ALL_DRIVERS, stops);
  expect(stops[0].driverName).toBe('Raul');
});

test('stop.driverName is rewritten to canonical username on case mismatch', () => {
  const stops = [{ driverName: 'raul' }];
  resolveDriverNames(ALL_DRIVERS, stops);
  expect(stops[0].driverName).toBe('Raul');
});

test('stop.driverName is rewritten to canonical username when CSV has trailing space', () => {
  // Simulate: raw CSV "Raul " → trimmed to "Raul" → matched → stored as "Raul"
  const trimmed = trimDriverName('Raul ');
  const stops = [{ driverName: trimmed }];
  resolveDriverNames(ALL_DRIVERS, stops);
  expect(stops[0].driverName).toBe('Raul');
});

test('stop.driverName is rewritten to username even when CSV used fullName', () => {
  const stops = [{ driverName: 'Raul Gonzalez' }];
  resolveDriverNames(ALL_DRIVERS, stops);
  // Must be "Raul" (username), NOT "Raul Gonzalez" (fullName)
  expect(stops[0].driverName).toBe('Raul');
});

test('multiple stops for same driver all rewritten correctly', () => {
  const stops = [
    { driverName: 'Raul' },
    { driverName: 'Raul' },
    { driverName: 'raul' },
    { driverName: 'Raul Gonzalez' },
  ];
  resolveDriverNames(ALL_DRIVERS, stops);
  for (const stop of stops) {
    expect(stop.driverName).toBe('Raul');
  }
});

test('stops for different drivers are each rewritten to their own canonical username', () => {
  const stops = [
    { driverName: 'raul' },
    { driverName: 'MARIO' },
    { driverName: 'Moises Aguiar' },
  ];
  resolveDriverNames(ALL_DRIVERS, stops);
  expect(stops[0].driverName).toBe('Raul');
  expect(stops[1].driverName).toBe('Mario');
  expect(stops[2].driverName).toBe('Moises');
});

// ─── Suite 5: Unmatched driver names ──────────────────────────────────────────

console.log('\n📋 Suite 5: Unmatched driver names are surfaced');

test('completely unknown driver name is in unmatchedDriverNames', () => {
  const stops = [{ driverName: 'Unknown Person' }];
  const { unmatchedDriverNames } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(unmatchedDriverNames).toContain('Unknown Person');
});

test('unmatchedDriverNames is empty when all names match', () => {
  const stops = [{ driverName: 'Raul' }, { driverName: 'Mario' }];
  const { unmatchedDriverNames } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(unmatchedDriverNames).toHaveLength(0);
});

test('only unmatched names appear in unmatchedDriverNames, not matched ones', () => {
  const stops = [
    { driverName: 'Raul' },
    { driverName: 'Ghost Driver' },
  ];
  const { unmatchedDriverNames } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(unmatchedDriverNames).toContain('Ghost Driver');
  expect(unmatchedDriverNames).not.toContain('Raul');
  expect(unmatchedDriverNames).toHaveLength(1);
});

test('stop.driverName is kept as-is (trimmed) when no match found', () => {
  const stops = [{ driverName: 'Ghost Driver' }];
  resolveDriverNames(ALL_DRIVERS, stops);
  expect(stops[0].driverName).toBe('Ghost Driver');
});

test('multiple unmatched names are all collected', () => {
  const stops = [
    { driverName: 'Ghost A' },
    { driverName: 'Ghost B' },
    { driverName: 'Raul' },
  ];
  const { unmatchedDriverNames } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(unmatchedDriverNames).toHaveLength(2);
  expect(unmatchedDriverNames).toContain('Ghost A');
  expect(unmatchedDriverNames).toContain('Ghost B');
});

// ─── Suite 6: The Raul split-section scenario ──────────────────────────────────

console.log('\n📋 Suite 6: The "Raul split-section" real-world scenario');

test('"Raul " (trailing space) and "Raul" in same CSV both resolve to same canonical username', () => {
  // Before the fix, these would have been stored as two different strings,
  // creating two "Driver: Raul" sections in the route detail page.
  const stop1 = { driverName: trimDriverName('Raul') };   // normal row
  const stop2 = { driverName: trimDriverName('Raul ') };  // row with trailing space
  const stops = [stop1, stop2];
  resolveDriverNames(ALL_DRIVERS, stops);
  expect(stop1.driverName).toBe('Raul');
  expect(stop2.driverName).toBe('Raul');
  // Both are identical → only ONE group in the route detail page
  expect(stop1.driverName).toBe(stop2.driverName);
});

test('"raul" (lowercase) and "Raul" in same CSV both resolve to same canonical username', () => {
  const stop1 = { driverName: trimDriverName('Raul') };
  const stop2 = { driverName: trimDriverName('raul') };
  const stops = [stop1, stop2];
  resolveDriverNames(ALL_DRIVERS, stops);
  expect(stop1.driverName).toBe(stop2.driverName);
  expect(stop1.driverName).toBe('Raul');
});

// ─── Suite 7: DB OR query still works after canonical rewrite ─────────────────

console.log('\n📋 Suite 7: DB query pattern (username OR fullName) still works after fix');

/**
 * After our fix, driverNameFromUpload is always the canonical username.
 * The DB query uses: { driverNameFromUpload: driver.username } OR { driverNameFromUpload: driver.fullName }
 * The username branch must always fire for matched stops.
 */
function simulateDBQuery(storedDriverName, driver) {
  // Mirrors the Prisma OR filter used in assigned-routes, safety-check, stops, etc.
  return (
    storedDriverName === driver.username ||
    (driver.fullName && storedDriverName === driver.fullName)
  );
}

test('canonical username stored in stop matches DB query username branch', () => {
  const stop = { driverName: trimDriverName('raul') };
  resolveDriverNames(ALL_DRIVERS, [stop]);
  // After rewrite, stop.driverName is "Raul" (canonical username)
  const matched = simulateDBQuery(stop.driverName, DRIVER_RAUL);
  expect(matched).toBe(true);
});

test('canonical username from fullName CSV match still matches DB query', () => {
  const stop = { driverName: trimDriverName('Raul Gonzalez') };
  resolveDriverNames(ALL_DRIVERS, [stop]);
  // stop.driverName is now "Raul", not "Raul Gonzalez"
  const matched = simulateDBQuery(stop.driverName, DRIVER_RAUL);
  expect(matched).toBe(true);
});

test('canonical username from space-trimmed CSV still matches DB query', () => {
  const stop = { driverName: trimDriverName('Mario ') };
  resolveDriverNames(ALL_DRIVERS, [stop]);
  const matched = simulateDBQuery(stop.driverName, DRIVER_MARIO);
  expect(matched).toBe(true);
});

test('a stop canonical username does NOT match a different driver', () => {
  const stop = { driverName: trimDriverName('Raul') };
  resolveDriverNames(ALL_DRIVERS, [stop]);
  const matched = simulateDBQuery(stop.driverName, DRIVER_MARIO);
  expect(matched).toBe(false);
});

test('unmatched stop (raw CSV name) does NOT match any existing driver', () => {
  const stop = { driverName: trimDriverName('Ghost Driver') };
  resolveDriverNames(ALL_DRIVERS, [stop]);
  const matchedRaul  = simulateDBQuery(stop.driverName, DRIVER_RAUL);
  const matchedMario = simulateDBQuery(stop.driverName, DRIVER_MARIO);
  expect(matchedRaul).toBe(false);
  expect(matchedMario).toBe(false);
});

// ─── Suite 8: Edge cases ──────────────────────────────────────────────────────

console.log('\n📋 Suite 8: Edge cases');

test('empty stops array produces no unmatched names', () => {
  const { unmatchedDriverNames } = resolveDriverNames(ALL_DRIVERS, []);
  expect(unmatchedDriverNames).toHaveLength(0);
});

test('stops with empty driverName are skipped gracefully', () => {
  const stops = [{ driverName: '' }, { driverName: 'Raul' }];
  const { unmatchedDriverNames } = resolveDriverNames(ALL_DRIVERS, stops);
  expect(unmatchedDriverNames).toHaveLength(0);
});

test('duplicate CSV names are deduplicated — lookup runs once per unique name', () => {
  const stops = [
    { driverName: 'Raul' },
    { driverName: 'Raul' },
    { driverName: 'Raul' },
  ];
  const { csvToCanonical } = resolveDriverNames(ALL_DRIVERS, stops);
  // Only one entry in the map for "Raul"
  expect(csvToCanonical.size).toBe(1);
});

test('no drivers in DB — all CSV names become unmatched', () => {
  const stops = [{ driverName: 'Raul' }, { driverName: 'Mario' }];
  const { unmatchedDriverNames } = resolveDriverNames([], stops);
  expect(unmatchedDriverNames).toHaveLength(2);
});

test('driver whose username is a number-like string still matches', () => {
  const numericDriver = { id: '99', username: 'Driver1', fullName: 'Driver One' };
  const stops = [{ driverName: 'driver1' }];
  const { csvToCanonical } = resolveDriverNames([numericDriver], stops);
  expect(csvToCanonical.get('driver1')).toBe('Driver1');
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.error}`));
  console.log('');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed — driver name matching logic is correct.\n');
  process.exit(0);
}
