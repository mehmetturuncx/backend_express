module.exports = {
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'], // <- .env dosyasını testlere yükler
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};