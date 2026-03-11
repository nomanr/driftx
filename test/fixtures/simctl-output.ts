export const simctlFixtures = {
  twoSimulators: JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
        {
          udid: 'ABC-DEF-123',
          name: 'iPhone 15',
          state: 'Booted',
          isAvailable: true,
        },
        {
          udid: 'GHI-JKL-456',
          name: 'iPhone 15 Pro',
          state: 'Shutdown',
          isAvailable: true,
        },
      ],
    },
  }),
  noSimulators: JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [],
    },
  }),
  singleBooted: JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
        {
          udid: 'ABC-DEF-123',
          name: 'iPhone 15',
          state: 'Booted',
          isAvailable: true,
        },
      ],
    },
  }),
  unavailableDevice: JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-17-2': [
        {
          udid: 'ABC-DEF-123',
          name: 'iPhone 15',
          state: 'Booted',
          isAvailable: false,
        },
      ],
    },
  }),
};
