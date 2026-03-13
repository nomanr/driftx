# Installing driftx for Cursor

## Prerequisites

- Node.js 18+
- `npm install -g driftx`

## Installation

1. **Copy the driftx skill into the project:**
   ```bash
   mkdir -p .cursor/rules
   cp "$(npm root -g)/driftx/driftx-plugin/skills/driftx/SKILL.md" .cursor/rules/driftx.md
   ```

2. **Verify the skill file exists:**
   ```bash
   cat .cursor/rules/driftx.md | head -5
   ```

3. **Check the environment:**
   ```bash
   driftx doctor
   ```

4. **Tell the user to close and restart the Cursor chat** for the skill to take effect.

## Updating

```bash
npm install -g driftx
cp "$(npm root -g)/driftx/driftx-plugin/skills/driftx/SKILL.md" .cursor/rules/driftx.md
```

## Uninstalling

```bash
rm .cursor/rules/driftx.md
npm uninstall -g driftx
```
