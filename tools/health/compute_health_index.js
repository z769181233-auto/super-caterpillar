const fs = require("fs");
const path = require("path");

const outDir = process.argv[2];
const readFileSafe = (filePath) => {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        return "";
    }
};

// 1. Dead Code
const dead = readFileSafe(outDir + "/dead_code.log").trim().split("\n").filter(Boolean).length;

// 2. Console Logs (Separating Core and Total)
const consoleLogLines = readFileSafe(outDir + "/console.log").trim().split("\n").filter(Boolean);

let consoleCore = 0;
let consoleTotal = 0;

const CORE_INCLUDE = ["apps/api/src", "packages/", "apps/workers/src"];
const EXCLUSIONS = [
    ".spec.ts", ".test.ts", ".spec.js", ".test.js", "__tests__",
    "apps/api/src/scripts", // Whitelist scripts
    "tools/", // Whitelist tools
    "docs/", "_evidence/", "node_modules/", "dist/", "build/",
    "src/generated/", "runtime/" // Exclude generated code (Prisma, etc.)
];

consoleLogLines.forEach(line => {
    consoleTotal++;

    // Check if it belongs to core and is not excluded
    const isCore = CORE_INCLUDE.some(inc => line.includes(inc));
    const isExcluded = EXCLUSIONS.some(exc => line.includes(exc));

    if (isCore && !isExcluded) {
        consoleCore++;
    }
});

// 3. Circular Dependencies
const circularLogContent = readFileSafe(outDir + "/circular.log").trim();
const stripAnsi = (str) => str.replace(/\x1B\[\d+m/g, "");

function parseCircularFromLog(text) {
    const t = stripAnsi(String(text || "")).trim();
    if (!t) return 0;
    if (/No circular dependency found/i.test(t)) return 0;
    if (/(circular dependencies detected|cycle detected|found\s+\d+\s+cycles?|found\s+\d+\s+circular|Detected\s+cycle)/i.test(t)) return 1;
    return 0;
}

const cir = parseCircularFromLog(circularLogContent);

// 4. Score Calculation
const score = Math.max(0, 100 - dead * 0.1 - consoleCore * 2 - cir * 10);

const res = {
    dead,
    console_total: consoleTotal,
    console_core: consoleCore,
    circular: cir,
    score
};

fs.writeFileSync(outDir + "/HEALTH_INDEX.json", JSON.stringify(res, null, 2));

console.log("Health Score Logic Updated (Phase H)");
console.log(JSON.stringify(res, null, 2));

// H-2 Blocking Condition: circular > 0 || console_core > 0
if (cir > 0) {
    console.error("GATE FAILED: Circular dependencies detected.");
    process.exit(23);
}

if (consoleCore > 0) {
    console.error(`GATE FAILED: ${consoleCore} console logs found in production core.`);
    process.exit(23);
}
