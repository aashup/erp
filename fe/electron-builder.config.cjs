/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.erp.desktop',
  productName: 'ERP',
  copyright: 'Copyright © 2025',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**',
    'dist-electron/**',
    '!dist/**/*.map',
    '!dist-electron/**/*.map',
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.business',
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Office',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
