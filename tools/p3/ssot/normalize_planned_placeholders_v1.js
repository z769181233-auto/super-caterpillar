#!/usr/bin/env node
/**
 * Normalize PLANNED table placeholders:
 * - adapter_path / gate_path / seal_tag: "-" => "" (empty)
 * Keep expected_* untouched.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SSOT = path.join(ROOT, "ENGINE_MATRIX_SSOT.md");

let s = fs.readFileSync(SSOT, "utf8");

const PLANNED_BEGIN = "<!-- SSOT_TABLE:PLANNED_BEGIN -->";
const PLANNED_END = "<!-- SSOT_TABLE:PLANNED_END -->";

const i = s.indexOf(PLANNED_BEGIN);
const j = s.indexOf(PLANNED_END);
if (i < 0 || j < 0 || j <= i) {
    console.error("[FATAL] PLANNED anchors not found or invalid.");
    process.exit(1);
}

const head = s.slice(0, i + PLANNED_BEGIN.length);
const block = s.slice(i + PLANNED_BEGIN.length, j);
const tail = s.slice(j);

const lines = block.split("\n");
let header = null;
const out = [];

for (const ln of lines) {
    if (!ln.trim().startsWith("|")) {
        out.push(ln);
        continue;
    }

    if (ln.includes("---")) {
        out.push(ln);
        continue;
    }

    const cols = ln.split("|").map(x => x.trim());
    const cells = cols.filter(x => x !== "");

    if (!header) {
        header = cells.map(x => x.replace(/`/g, "").trim());
        out.push(ln);
        continue;
    }

    // data row
    const row = {};
    header.forEach((k, idx) => {
        row[k] = (cells[idx] ?? "").replace(/`/g, "").trim();
    });

    if (!row.engine_key) {
        out.push(ln);
        continue;
    }

    // Normalize: "-" => "" for adapter_path, gate_path, seal_tag
    const keysToNormalize = ["adapter_path", "gate_path", "seal_tag"];
    for (const k of keysToNormalize) {
        if (row[k] === "-") row[k] = "";
    }

    // Rebuild row line
    function fmtCell(k, v) {
        if (!v) return "";
        if (["engine_key", "job_type", "expected_adapter_path", "expected_gate_path", "seal_tag"].includes(k) && v !== "-") {
            return "`" + v + "`";
        }
        return v;
    }

    const rebuilt = "| " + header.map(k => fmtCell(k, row[k] || "")).join(" | ") + " |";
    out.push(rebuilt);
}

const next = head + "\n" + out.join("\n") + tail;
fs.writeFileSync(SSOT, next, "utf8");
console.log("[OK] normalized PLANNED placeholders: '-' => '' (empty)");
