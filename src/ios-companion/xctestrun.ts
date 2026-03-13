export function rewriteXctestrun(content: string, prebuiltDir: string, port: number): string {
  let result = content;

  const rootMatch = result.match(/((?:__TESTROOT__|[^<\s]+?))\/Debug-/);
  if (rootMatch) {
    const originalRoot = rootMatch[1];
    const escaped = originalRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), prebuiltDir);
  }

  const envTag = '<key>TestingEnvironmentVariables</key>';
  const envIdx = result.indexOf(envTag);
  if (envIdx !== -1) {
    const dictOpenIdx = result.indexOf('<dict>', envIdx);
    if (dictOpenIdx !== -1) {
      const insertPos = dictOpenIdx + '<dict>'.length;
      const portEntry = `\n\t\t\t<key>DRIFTX_PORT</key>\n\t\t\t<string>${port}</string>`;
      result = result.slice(0, insertPos) + portEntry + result.slice(insertPos);
    }
  } else {
    const testConfigKey = '<key>DriftxCompanionUITests</key>';
    const configIdx = result.indexOf(testConfigKey);
    if (configIdx !== -1) {
      const closingDict = result.indexOf('</dict>', configIdx);
      if (closingDict !== -1) {
        const envBlock = `\t\t<key>TestingEnvironmentVariables</key>\n\t\t<dict>\n\t\t\t<key>DRIFTX_PORT</key>\n\t\t\t<string>${port}</string>\n\t\t</dict>\n\t`;
        result = result.slice(0, closingDict) + envBlock + result.slice(closingDict);
      }
    }
  }

  return result;
}
