import path from 'path'

const APP_PATH = path.resolve(
  './ios/build/Build/Products/Debug-iphonesimulator/App.app'
)

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./e2e/specs/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      platformName: 'iOS',
      'appium:deviceName': 'iPhone 17',
      'appium:platformVersion': '26.3',
      'appium:app': APP_PATH,
      'appium:automationName': 'XCUITest',
      'appium:bundleId': 'com.morikuma.habitas',
      'appium:newCommandTimeout': 240,
      'appium:wdaLaunchTimeout': 180000,
      'appium:showXcodeLog': true,
    },
  ],
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          relaxedSecurity: true,
          log: './appium.log',
        },
      },
    ],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
}
