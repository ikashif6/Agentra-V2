/** Workspace activity event types and display labels. */
const EVENT_LABELS = {
  'workspace.created': 'Workspace created',
  'user.login': 'Signed in',
  'user.invited': 'User invited',
  'user.updated': 'User updated',
  'user.removed': 'User removed',
  'billing.plan_canceled': 'Plan cancellation scheduled',
  'billing.plan_reactivated': 'Plan reactivated',
  'store.connected': 'Store connected',
  'store.disconnected': 'Store disconnected',
  'business_hours.updated': 'Business hours updated',
  'team.created': 'Team created',
  'profile.updated': 'Profile updated',
  'security.password_changed': 'Password changed',
};

const FILTERABLE_EVENTS = Object.entries(EVENT_LABELS).map(([id, label]) => ({ id, label }));

module.exports = {
  EVENT_LABELS,
  FILTERABLE_EVENTS,
};
