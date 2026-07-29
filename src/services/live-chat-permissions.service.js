/**
 * Workspace AI permissions — enforced in code, never by prompt alone.
 */

function defaultPermissions(channelAi = {}) {
  const actions = channelAi.allowedActions || {};
  return {
    viewOrders: true,
    trackOrders: true,
    answerPolicies: true,
    recommendProducts: actions.productRecommendations !== false,
    startReturns: true,
    createReturns: Boolean(actions.createReturns),
    exchangeItems: Boolean(actions.exchangeItems),
    cancelOrders: Boolean(actions.cancelOrder),
    // The settings UI and Company schema expose this capability as `editOrder`.
    // Keep the older aliases for backwards compatibility.
    changeDeliveryAddress: Boolean(
      actions.changeAddress ?? actions.updateAddress ?? actions.editOrder,
    ),
    issueRefunds: Boolean(actions.refundOrder),
    issueStoreCredit: Boolean(actions.issueStoreCredit),
    applyDiscounts: {
      enabled: Boolean(actions.applyDiscount),
      maximumPercent: Number(actions.maxDiscountPercent || 0),
    },
    handoffToHuman: actions.requestHuman !== false,
    maxRefundAmount: Number(actions.maxRefundAmount ?? 100),
  };
}

function assertPermission(permissions, key) {
  const perms = permissions || {};
  if (key === 'applyDiscounts') {
    if (!perms.applyDiscounts?.enabled) {
      const err = new Error('ACTION_NOT_PERMITTED');
      err.code = 'ACTION_NOT_PERMITTED';
      err.safeMessage = 'A support specialist is required for that.';
      throw err;
    }
    return true;
  }
  if (!perms[key]) {
    const err = new Error('ACTION_NOT_PERMITTED');
    err.code = 'ACTION_NOT_PERMITTED';
    err.safeMessage = 'A support specialist is required for that.';
    throw err;
  }
  return true;
}

function canPerform(permissions, key) {
  try {
    assertPermission(permissions, key);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  defaultPermissions,
  assertPermission,
  canPerform,
};
