# Installing driftx for Codex

## Prerequisites

- Git
- Node.js 18+
- `npm install -g driftx`

## Installation

1. **Clone the driftx repository:**
   ```bash
   git clone https://github.com/nomanr/driftx.git ~/.codex/driftx
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/driftx/driftx-plugin/skills ~/.agents/skills/driftx
   ```

3. **Verify the setup:**
   ```bash
   ls -la ~/.agents/skills/driftx
   driftx doctor
   ```

4. **Tell the user to close and restart the Codex chat** for the skill to take effect.

## Updating

```bash
cd ~/.codex/driftx && git pull
npm install -g driftx
```

## Uninstalling

```bash
rm ~/.agents/skills/driftx
rm -rf ~/.codex/driftx
npm uninstall -g driftx
```
