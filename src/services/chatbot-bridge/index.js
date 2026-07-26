module.exports = {
  ...require('./auth'),
  ...require('./workspace-config.service'),
  ...require('./knowledge.service'),
  ...require('./commerce.service'),
  ...require('./client'),
  ...require('./bridge.service'),
};
