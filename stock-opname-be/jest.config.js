process.env.NODE_ENV = 'test';

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  testTimeout: 20000
};
