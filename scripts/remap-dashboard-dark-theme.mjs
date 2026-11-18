/**
 * One-shot remapper: light dashboard hex → dark theme CSS variables.
 * Safe to re-run (idempotent for already-remapped var() values).
 */
import fs from "node:fs";
import path from "node:path";

const roots = [
  path.resolve("app/dashboard"),
  path.resolve("components/dashboard"),
];

/** Exact hex → var (case-insensitive). Longer keys first via sort. */
const HEX_MAP = {
  // Surfaces / page bg
  "#f9fafb": "var(--dash-bg)",
  "#f8fafc": "var(--dash-bg-subtle)",
  "#f1f5f9": "var(--dash-surface-2)",
  "#f3f4f6": "var(--dash-surface-2)",
  "#ffffff": "var(--dash-surface)",
  "#fff": "var(--dash-surface)",

  // Borders
  "#e2e8f0": "var(--dash-border)",
  "#e5e7eb": "var(--dash-border)",
  "#cbd5e1": "var(--dash-border-strong)",
  "#d1d5db": "var(--dash-border-strong)",

  // Text strong → muted scale
  "#0f172a": "var(--dash-text)",
  "#111827": "var(--dash-text)",
  "#1f2937": "var(--dash-text-secondary)",
  "#334155": "var(--dash-text-secondary)",
  "#374151": "var(--dash-text-secondary)",
  "#475569": "var(--dash-text-muted)",
  "#64748b": "var(--dash-text-muted)",
  "#6b7280": "var(--dash-text-dim)",
  "#94a3b8": "var(--dash-text-muted)",
  "#9ca3af": "var(--dash-text-muted)",

  // Former teal accent → brand orange
  "#0f766e": "var(--dash-primary)",
  "#0d9488": "var(--dash-primary-mid)",
  "#14b8a6": "var(--dash-primary-mid)",
  "#047857": "var(--dash-primary)",
  "#099268": "var(--dash-primary)",
  "#99f6e4": "var(--dash-primary-border)",
  "#a7f3d0": "var(--dash-success-border)",
  "#f0fdfa": "var(--dash-primary-soft)",
  "#ecfdf5": "var(--dash-success-bg)",
  "#ccfbf1": "var(--dash-primary-soft-mid)",

  // Blue accents → orange (sidebar / links)
  "#3b82f6": "var(--dash-primary)",
  "#2563eb": "var(--dash-primary-mid)",
  "#1d4ed8": "var(--dash-primary)",
  "#1e40af": "var(--dash-primary)",
  "#1e3a5f": "var(--dash-text-secondary)",
  "#eff6ff": "var(--dash-primary-soft)",
  "#dbeafe": "var(--dash-primary-soft-mid)",
  "#bfdbfe": "var(--dash-primary-border)",
  "#93c5fd": "var(--dash-info)",

  // Danger
  "#b91c1c": "var(--dash-danger)",
  "#991b1b": "var(--dash-danger-strong)",
  "#dc2626": "var(--dash-danger-strong)",
  "#ef4444": "var(--dash-danger-strong)",
  "#fef2f2": "var(--dash-danger-bg)",
  "#fee2e2": "var(--dash-danger-bg)",
  "#fecaca": "var(--dash-danger-border)",
  "#fca5a5": "var(--dash-danger-border)",

  // Warn / amber
  "#b45309": "var(--dash-warn)",
  "#92400e": "var(--dash-warn-strong)",
  "#9a3412": "var(--dash-warn-strong)",
  "#d97706": "var(--dash-warn-strong)",
  "#fffbeb": "var(--dash-warn-bg)",
  "#fff7ed": "var(--dash-warn-bg)",
  "#fef3c7": "var(--dash-warn-bg)",
  "#fde68a": "var(--dash-warn-border)",
  "#fdba74": "var(--dash-primary-light)",
  "#fbbf24": "var(--dash-warn)",

  // Success leftovers
  "#22c55e": "var(--dash-success-strong)",
  "#16a34a": "var(--dash-success-strong)",
  "#4ade80": "var(--dash-success)",
};

const RGBA_MAP = [
  // Soft shadows that assumed light cards
  {
    from: /rgba\(\s*15\s*,\s*23\s*,\s*42\s*,\s*0\.0?6\s*\)/gi,
    to: "var(--dash-shadow)",
  },
  {
    from: /rgba\(\s*15\s*,\s*23\s*,\s*42\s*,\s*0\.08\s*\)/gi,
    to: "rgba(0, 0, 0, 0.45)",
  },
  {
    from: /rgba\(\s*15\s*,\s*118\s*,\s*110\s*,\s*0\.1(?:0)?\s*\)/gi,
    to: "rgba(255, 77, 0, 0.18)",
  },
  {
    from: /rgba\(\s*15\s*,\s*118\s*,\s*110\s*,\s*0\.1[25]\s*\)/gi,
    to: "rgba(255, 77, 0, 0.2)",
  },
  {
    from: /rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*0\.1(?:0)?\s*\)/gi,
    to: "var(--dash-primary-soft)",
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".css") && entry.name !== "dashboard-theme.css") {
      out.push(full);
    }
  }
  return out;
}

function remapContent(content) {
  let next = content;

  for (const { from, to } of RGBA_MAP) {
    next = next.replace(from, to);
  }

  const keys = Object.keys(HEX_MAP).sort((a, b) => b.length - a.length);
  for (const hex of keys) {
    const re = new RegExp(hex.replace("#", "#"), "gi");
    // Avoid replacing inside already-written var() by checking context is crude hex use
    next = next.replace(re, HEX_MAP[hex.toLowerCase()] ?? HEX_MAP[hex]);
  }

  // Normalize accidental double-wrapping if re-run somehow left literals
  return next;
}

const files = roots.flatMap((r) => (fs.existsSync(r) ? walk(r) : []));
let changed = 0;

for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const after = remapContent(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
    console.log("updated", path.relative(process.cwd(), file));
  }
}

console.log(`Done. ${changed}/${files.length} files updated.`);
