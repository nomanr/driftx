export const adbFixtures = {
  twoDevices: `List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 transport_id:1
emulator-5556          device product:sdk_gphone64_arm64 model:Pixel_7 transport_id:2

`,
  singleDevice: `List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 transport_id:1

`,
  noDevices: `List of devices attached

`,
  offlineDevice: `List of devices attached
emulator-5554          offline transport_id:1

`,
  unauthorizedDevice: `List of devices attached
ABCDEF123456           unauthorized transport_id:1

`,
  mixedStates: `List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:Pixel_7 transport_id:1
ABCDEF123456           unauthorized transport_id:2
emulator-5556          offline transport_id:3

`,
  malformed: `Some unexpected output format
that does not match the expected pattern`,
  apiLevel28: 'sdk_gphone64_arm64\n',
  apiLevel34: '34\n',
};
