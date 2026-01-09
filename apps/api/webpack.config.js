const path = require('path');

module.exports = function (options) {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        ...(options.resolve?.alias || {}),
        config: path.resolve(__dirname, '../../packages/config/src'),
      },
    },
    externals: [...(options.externals || [])],
  };
};
