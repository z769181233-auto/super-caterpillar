'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.env = exports.config = void 0;
// 配置管理
var env_1 = require('./env');
Object.defineProperty(exports, 'config', {
  enumerable: true,
  get: function () {
    return env_1.env;
  },
});
var env_2 = require('./env');
Object.defineProperty(exports, 'env', {
  enumerable: true,
  get: function () {
    return env_2.env;
  },
});
