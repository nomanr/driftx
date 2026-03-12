# Claude Code Plugin — Design Spec

**Goal:** Integrate drift with Claude Code so AI agents can run visual comparisons, accessibility audits, and regression detection as part of their workflow.

**Approach:** Skill-based plugin (markdown instruction files) rather than MCP server or tool wrappers. drift's CLI with `--format json` already provides structured output — the plugin teaches Claude Code how to use it effectively.

**Rationale:** An MCP server would duplicate the CLI's functionality with ~500 lines of wrapper code and a new dependency. The CLI already supports `--format json` for structured output and writes artifacts to `.drift/runs/`. A skill file achieves the same integration with zero code.

---

## Structure

```
drift-plugin/
  skills/
    drift.md          # Main skill — command reference, output interpretation, workflow patterns
```

## What the Skill Covers

1. **Trigger conditions** — when to use drift (design comparison, a11y audit, regression, tree inspection)
2. **Command reference** — all CLI commands with flags and examples
3. **Analysis selection** — available analyses, smart defaults, `--with`/`--without`
4. **Output interpretation** — JSON CompareReport structure, finding categories/severities
5. **Artifact locations** — `.drift/runs/<runId>/` directory contents
6. **Workflow patterns** — Figma integration, a11y audit, regression, full audit
7. **Configuration** — `.driftrc.json` settings
8. **Error handling** — common errors and fixes

## Installation

```bash
# Symlink into Claude Code plugins directory
ln -s /path/to/drift/drift-plugin ~/.claude/plugins/drift
```

Or copy the directory manually.

## Figma MCP Integration

The skill includes a workflow pattern for Figma MCP. When a Figma MCP server is connected, Claude Code can:
1. Export a design frame from Figma as PNG
2. Pass it to `drift compare --design <path> --format json`
3. Interpret findings and suggest code fixes

This requires no drift code changes — the Figma MCP and drift skill work independently.
