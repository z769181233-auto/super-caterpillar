#!/usr/bin/env node
'use strict';
const fs = require('fs');

const f = process.argv[2];
if (!f) { console.error('Usage: summarize_failed_gates.js <FAILED_GATES.json>'); process.exit(2); }
const arr = JSON.parse(fs.readFileSync(f, 'utf8'));

const syntax = arr.filter(x => x.syntax_ok === false);
const run1 = arr.filter(x => x.syntax_ok === true && x.run1_ok === false);
const run2 = arr.filter(x => x.syntax_ok === true && x.run1_ok === true && x.run2_ok === false);

function pickErr(s) { return String(s || '').split('\n').slice(0, 6).join('\n'); }

console.log(`FAILED_GATES_TOTAL=${arr.length}`);
console.log(`SYNTAX_FAIL=${syntax.length}`);
console.log(`RUN1_FAIL=${run1.length}`);
console.log(`RUN2_FAIL=${run2.length}`);
console.log('--- SYNTAX ---');
for (const x of syntax) console.log(`- ${x.gate_path}\n  ${pickErr(x.error)}\n  logs: ${x.logs?.syntax}`);
console.log('--- RUN1 ---');
for (const x of run1) console.log(`- ${x.gate_path}\n  ${pickErr(x.error)}\n  logs: ${x.logs?.run1}`);
console.log('--- RUN2 ---');
for (const x of run2) console.log(`- ${x.gate_path}\n  ${pickErr(x.error)}\n  logs: ${x.logs?.run2}`);
