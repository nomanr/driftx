import { describe, it, expect } from 'vitest';
import { rewriteXctestrun } from '../../../src/ios-companion/xctestrun.js';

const SAMPLE_XCTESTRUN = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>DriftxCompanionUITests</key>
\t<dict>
\t\t<key>TestBundlePath</key>
\t\t<string>__TESTROOT__/Debug-iphonesimulator/DriftxCompanionUITests-Runner.app/PlugIns/DriftxCompanionUITests.xctest</string>
\t\t<key>TestHostPath</key>
\t\t<string>__TESTROOT__/Debug-iphonesimulator/DriftxCompanionUITests-Runner.app</string>
\t\t<key>UITargetAppPath</key>
\t\t<string>__TESTROOT__/Debug-iphonesimulator/DriftxCompanion.app</string>
\t\t<key>DependentProductPaths</key>
\t\t<array>
\t\t\t<string>__TESTROOT__/Debug-iphonesimulator/DriftxCompanion.app</string>
\t\t\t<string>__TESTROOT__/Debug-iphonesimulator/DriftxCompanionUITests-Runner.app</string>
\t\t</array>
\t\t<key>TestingEnvironmentVariables</key>
\t\t<dict>
\t\t</dict>
\t</dict>
\t<key>__xctestrun_metadata__</key>
\t<dict>
\t\t<key>FormatVersion</key>
\t\t<integer>2</integer>
\t</dict>
</dict>
</plist>`;

describe('rewriteXctestrun', () => {
  it('replaces __TESTROOT__ with actual prebuilt path', () => {
    const result = rewriteXctestrun(SAMPLE_XCTESTRUN, '/usr/local/lib/node_modules/driftx/ios-companion/prebuilt', 8300);
    expect(result).toContain('/usr/local/lib/node_modules/driftx/ios-companion/prebuilt/Debug-iphonesimulator/DriftxCompanionUITests-Runner.app');
    expect(result).toContain('/usr/local/lib/node_modules/driftx/ios-companion/prebuilt/Debug-iphonesimulator/DriftxCompanion.app');
    expect(result).not.toContain('__TESTROOT__/Debug');
  });

  it('injects DRIFTX_PORT into TestingEnvironmentVariables', () => {
    const result = rewriteXctestrun(SAMPLE_XCTESTRUN, '/tmp/prebuilt', 8305);
    expect(result).toContain('<key>DRIFTX_PORT</key>');
    expect(result).toContain('<string>8305</string>');
  });

  it('handles absolute build paths (not just __TESTROOT__)', () => {
    const withAbsPath = SAMPLE_XCTESTRUN.replace(/__TESTROOT__/g, '/Users/dev/Library/Developer/Xcode/DerivedData/Build/Products');
    const result = rewriteXctestrun(withAbsPath, '/tmp/prebuilt', 8300);
    expect(result).toContain('/tmp/prebuilt/Debug-iphonesimulator/DriftxCompanion.app');
    expect(result).not.toContain('/Users/dev/Library');
  });

  it('preserves other plist content unchanged', () => {
    const result = rewriteXctestrun(SAMPLE_XCTESTRUN, '/tmp/prebuilt', 8300);
    expect(result).toContain('<key>FormatVersion</key>');
    expect(result).toContain('<integer>2</integer>');
  });
});
