#!/usr/bin/env node
/**
 * File Purpose: Summarize exported Hexodus session diagnostic JSON from beta testers.
 * Primary Functions: read JSON file, print dress/fb/circuit/rim rollups.
 * Inputs/Outputs: argv[2] path → stdout summary (non-zero exit on missing file).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/beta-diag-summary.mjs <export.json>");
  process.exit(1);
}
const abs = resolve(path);
if (!existsSync(abs)) {
  console.error("File not found:", abs);
  process.exit(1);
}

const raw = readFileSync(abs, "utf8");
const data = JSON.parse(raw);

const rows = Array.isArray(data)
  ? data
  : Array.isArray(data.stored)
    ? data.stored
    : [];

if (rows.length === 0) {
  console.log(
    "No snapshot rows found (expected `stored` array or top-level array)."
  );
  process.exit(0);
}

let dress = 0;
let fb = 0;
let circuit = 0;
let rim = 0;
for (const r of rows) {
  dress += Number(r.directorDressingCalls) || 0;
  fb += Number(r.directorFallbackCount) || 0;
  circuit += Number(r.directorCircuitDegradedCount) || 0;
  rim += Number(r.generatorRimFallbackCount) || 0;
}

const last = rows[rows.length - 1];
console.log("Hexodus session diag summary");
console.log("  snapshots:", rows.length);
console.log(
  "  sums — dress:",
  dress,
  "fb:",
  fb,
  "circuit:",
  circuit,
  "rim:",
  rim
);
if (dress > 0) {
  console.log(
    "  rates — fb/dress:",
    ((fb / dress) * 100).toFixed(1) + "%",
    "circuit/dress:",
    ((circuit / dress) * 100).toFixed(1) + "%"
  );
}
console.log("  last reason:", last?.reason, "runId:", last?.runId);
