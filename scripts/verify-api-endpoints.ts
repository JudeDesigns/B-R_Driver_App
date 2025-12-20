
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const APP_DIR = path.join(process.cwd(), 'src/app');
const API_DIR = path.join(APP_DIR, 'api');

// 1. Find all defined API Routes
function getDefinedRoutes(): string[] {
    const routeFiles = glob.sync('**/route.{ts,js}', { cwd: API_DIR });
    return routeFiles.map(file => {
        // Convert file path to route path
        // e.g., "admin/dashboard/route.ts" -> "/api/admin/dashboard"
        const routePath = path.dirname(file);
        return `/api/${routePath}`;
    });
}

// 2. Find all API usages in Frontend
function getFrontendApiUsages(): { file: string; line: number; url: string }[] {
    const frontendFiles = glob.sync('**/*.{tsx,ts,js,jsx}', {
        cwd: APP_DIR,
        ignore: ['api/**'] // Ignore API definitions themselves
    });

    const usages: { file: string; line: number; url: string }[] = [];
    const urlRegex = /["']\/api\/([^"']+)["']/g;

    frontendFiles.forEach(file => {
        const content = fs.readFileSync(path.join(APP_DIR, file), 'utf-8');
        const lines = content.split('\n');

        lines.forEach((lineContent, index) => {
            let match;
            while ((match = urlRegex.exec(lineContent)) !== null) {
                usages.push({
                    file: path.join('src/app', file),
                    line: index + 1,
                    url: match[0].replace(/["']/g, '') // Remove quotes
                });
            }
        });
    });

    return usages;
}

// 3. Match and Verify
function verifyRoutes() {
    console.log('🚀 Starting Frontend-Backend Connection Verification...\n');

    const definedRoutes = getDefinedRoutes();
    console.log(`✅ Found ${definedRoutes.length} defined API routes.`);

    const usages = getFrontendApiUsages();
    console.log(`🔍 Found ${usages.length} API calls in frontend code.`);

    const errors: string[] = [];
    const warnings: string[] = [];

    usages.forEach(usage => {
        // Normalize usage URL for comparison
        // Remove query params
        const cleanUrl = usage.url.split('?')[0];

        // Handle dynamic routes matching
        // defined: /api/admin/users/[id]
        // usage: /api/admin/users/${userId} -> this regex won't catch template literals easily if they are backticks
        // But our regex caught string literals. 
        // If the code uses backticks `/api/admin/users/${id}`, our regex might miss it or catch part of it.
        // Let's assume for now we are checking static strings or simple concatenations if captured.

        // Simple exact match check first
        const exactMatch = definedRoutes.includes(cleanUrl);

        if (!exactMatch) {
            // Try to match dynamic routes
            // e.g. usage: /api/admin/users/123 (unlikely in code, usually variable)
            // e.g. defined: /api/admin/users/[id]

            // Convert defined route to regex: [id] -> [^/]+
            const dynamicMatch = definedRoutes.some(route => {
                const routeRegexStr = route
                    .replace(/\[.*?\]/g, '[^/]+') // Replace [param] with wildcard
                    .replace(/\//g, '\\/'); // Escape slashes
                const routeRegex = new RegExp(`^${routeRegexStr}$`);
                return routeRegex.test(cleanUrl);
            });

            if (!dynamicMatch) {
                // Check if it's a template literal usage that we can't fully validate statically
                if (cleanUrl.includes('${')) {
                    warnings.push(`⚠️  Potential dynamic URL needs manual check: "${usage.url}" in ${usage.file}:${usage.line}`);
                } else {
                    errors.push(`❌ Broken Link: Frontend calls "${usage.url}" but no such route exists. (${usage.file}:${usage.line})`);
                }
            }
        }
    });

    console.log('\n--- Verification Results ---');
    if (errors.length === 0) {
        console.log('✅ No broken static API links found.');
    } else {
        console.log(`❌ Found ${errors.length} broken links:`);
        errors.forEach(e => console.log(e));
    }

    if (warnings.length > 0) {
        console.log(`\n⚠️  ${warnings.length} warnings (dynamic URLs):`);
        warnings.forEach(w => console.log(w));
    }
}

verifyRoutes();
