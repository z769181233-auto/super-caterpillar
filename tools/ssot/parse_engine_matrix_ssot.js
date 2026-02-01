#!/usr/bin/env node
const fs = require("fs");

const ssotPath = process.argv[2] || "ENGINE_MATRIX_SSOT.md";
const text = fs.readFileSync(ssotPath, "utf8");

function sliceBetween(begin, end) {
  const b = text.indexOf(begin);
  const e = text.indexOf(end);
  if (b < 0 || e < 0 || e <= b) return "";
  return text.slice(b + begin.length, e);
}

function parseTable(block) {
  const lines = block.split("\n").map(s=>s.trim()).filter(Boolean);
  const rows = [];
  for (const ln of lines) {
    if (!ln.startsWith("|")) continue;
    if (ln.includes("---")) continue;         // separator
    if (ln.includes("engine_key") && ln.includes("job_type")) continue; // header
    const cols = ln.split("|").map(s=>s.trim()).filter(s => s !== "");
    if (cols.length < 8) continue;
    const [engine_key_raw, job_type_raw, state, billing, audit_prefix, adapter_path_raw, gate_path_raw, seal_tag_raw, notes] = cols;
    
    const engine_key = engine_key_raw.replace(/`/g, "").trim();
    const job_type = job_type_raw.replace(/`/g, "").trim();
    const adapter_path = adapter_path_raw.replace(/`/g, "").trim();
    const gate_path = gate_path_raw.replace(/`/g, "").trim();
    const seal_tag = seal_tag_raw.replace(/`/g, "").trim();

    rows.push({ 
        engine_key, 
        job_type, 
        state, 
        billing, 
        audit_prefix, 
        adapter_path, 
        gate_path, 
        seal_tag, 
        notes: notes ? notes.trim() : "" 
    });
  }
  return rows;
}

const sealed = parseTable(sliceBetween("<!-- SSOT_TABLE:SEALED_BEGIN -->", "<!-- SSOT_TABLE:SEALED_END -->"));
const inprogress = parseTable(sliceBetween("<!-- SSOT_TABLE:INPROGRESS_BEGIN -->", "<!-- SSOT_TABLE:INPROGRESS_END -->"));
const planned = parseTable(sliceBetween("<!-- SSOT_TABLE:PLANNED_BEGIN -->", "<!-- SSOT_TABLE:PLANNED_END -->"));

function uniqKeys(rows){ return Array.from(new Set(rows.map(r=>r.engine_key).filter(Boolean))); }

const out = {
  ssotPath,
  counts: { sealed: sealed.length, inprogress: inprogress.length, planned: planned.length },
  keys: { sealed: uniqKeys(sealed), inprogress: uniqKeys(inprogress), planned: uniqKeys(planned) },
  rows: { sealed, inprogress, planned }
};
process.stdout.write(JSON.stringify(out, null, 2));
