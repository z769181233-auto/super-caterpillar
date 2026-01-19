# Evidence Generation Best Practices

## Anti-Patterns (Avoid)

### ❌ Full File Content Embedding

```bash
# BAD: Embeds entire file content
cat > evidence.md <<EOF
Output:
\`\`\`
\$(cat docs/_evidence/phaseD/INDEX.md)
\`\`\`
EOF
```

### ❌ Concatenating Multiple Files

```bash
# BAD: Concatenates multiple evidence files
for f in docs/_evidence/phaseD/*.md; do
  cat "$f" >> output.md
done
```

### ❌ Full Script Content

```bash
# BAD: Includes entire script
cat > evidence.md <<EOF
Script:
\`\`\`
\$(cat tools/dev/deprecation_guard.sh)
\`\`\`
EOF
```

## Best Practices (Use)

### ✅ File Paths + Snippets

```bash
# GOOD: Reference paths and show snippets
cat > evidence.md <<EOF
## Artifacts

- docs/_evidence/phaseD/INDEX.md
- docs/_evidence/feature_phase_gate_20251219.md
- tools/dev/deprecation_guard.sh

## INDEX.md (head 40)

\`\`\`
\$(sed -n '1,40p' docs/_evidence/phaseD/INDEX.md)
\`\`\`

## deprecation_guard.sh (head 20)

\`\`\`
\$(sed -n '1,20p' tools/dev/deprecation_guard.sh)
\`\`\`
EOF
```

### ✅ Command Output Only (Tail/Head)

```bash
# GOOD: Only capture relevant output
cat > evidence.md <<EOF
## verify_entry.sh output

\`\`\`
\$(bash docs/_evidence/_tools/verify_entry.sh 2>&1 | tail -n 120)
\`\`\`
EOF
```

### ✅ Deduplication Protection

```bash
# GOOD: Ensure single occurrence
if ! grep -q "## Verification" evidence.md; then
  echo "## Verification" >> evidence.md
  echo "\`\`\`" >> evidence.md
  bash verify.sh >> evidence.md
  echo "\`\`\`" >> evidence.md
fi
```

## Guidelines

1. **Output file paths, not full contents** - Use `printf " - %s\n" file1 file2`
2. **Use snippets when needed** - Use `sed -n '1,40p'` or `tail -n 120`
3. **Avoid concatenation** - Don't `cat` multiple evidence files together
4. **Single occurrence** - Check before appending to avoid duplicates
5. **Command output only** - Capture `verify_entry.sh` output, not script source

## Enforcement

For any script that prints evidence/log output to terminal/CI logs, route output through:

- `tools/dev/_lib/dedupe_print.sh` (dedupe)
- `tools/dev/_lib/evidence_output_sanity_check.sh` (fails if script bodies are dumped repeatedly)

Reference executable example:

- `tools/dev/evidence_output_guidelines.sh`

## Reference

See: `tools/dev/evidence_output_guidelines.sh` for executable examples.
