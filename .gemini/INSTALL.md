# Installing driftx for Gemini CLI

## Prerequisites

- Node.js 18+
- `npm install -g driftx`

## Installation

1. **Copy the driftx skill into the project:**
   ```bash
   cp "$(npm root -g)/driftx/driftx-plugin/skills/driftx/SKILL.md" AGENTS.md
   ```

   If the project already has an `AGENTS.md`, append instead:
   ```bash
   echo "" >> AGENTS.md
   cat "$(npm root -g)/driftx/driftx-plugin/skills/driftx/SKILL.md" >> AGENTS.md
   ```

2. **Verify the skill file exists:**
   ```bash
   head -5 AGENTS.md
   ```

3. **Check the environment:**
   ```bash
   driftx doctor
   ```

4. **Tell the user to close and restart the Gemini CLI chat** for the skill to take effect.

## Updating

```bash
npm install -g driftx
cp "$(npm root -g)/driftx/driftx-plugin/skills/driftx/SKILL.md" AGENTS.md
```

## Uninstalling

```bash
rm AGENTS.md   # or remove the driftx section if other content exists
npm uninstall -g driftx
```
