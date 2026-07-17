/**
 * Unit tests for live-chat extraction, state merge, and handoff cancel.
 * Run: node --test test/live-chat-orchestration.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  extractOrderNumber,
  extractEmail,
} = require('../src/services/live-chat-tools.service');

const {
  mergeCollectedFields,
  getMissingFields,
  getSafeHandoffMessage,
  wantsCancelHandoff,
  wantsAcceptHandoff,
  cancelHandoffByCustomer,
  offerHandoff,
  isHandoffPending,
  HANDOFF_STATUSES,
  ACTIVE_RESPONDERS,
  applyExtractedToWorkflow,
  defaultHandoffState,
} = require('../src/services/live-chat-workflow.service');

describe('deterministic entity extraction', () => {
  it('extracts order + email from combined message', () => {
    const msg = '1001, kashif.61764@iqra.edu.pk';
    assert.equal(extractOrderNumber(msg), '1001');
    assert.equal(extractEmail(msg), 'kashif.61764@iqra.edu.pk');
  });

  it('extracts when email comes first', () => {
    const msg = 'kashif.61764@iqra.edu.pk, 1001';
    assert.equal(extractOrderNumber(msg), '1001');
    assert.equal(extractEmail(msg), 'kashif.61764@iqra.edu.pk');
  });

  it('extracts #1001 and order prefixes', () => {
    assert.equal(extractOrderNumber('#1001'), '1001');
    assert.equal(extractOrderNumber('order 1001'), '1001');
    assert.equal(extractOrderNumber('order number 1001'), '1001');
    assert.equal(extractOrderNumber('my order is #1001'), '1001');
    assert.equal(extractOrderNumber('AG-1001'), 'AG-1001');
  });

  it('does not treat email local-part digits as order number alone', () => {
    assert.equal(extractOrderNumber('kashif.61764@iqra.edu.pk'), null);
    assert.equal(extractEmail('kashif.61764@iqra.edu.pk'), 'kashif.61764@iqra.edu.pk');
  });
});

describe('state merge', () => {
  it('merges new fields without wiping existing ones', () => {
    const merged = mergeCollectedFields(
      { orderNumber: '1001', email: null },
      { email: 'a@b.com', returnReason: 'too_small' },
    );
    assert.equal(merged.orderNumber, '1001');
    assert.equal(merged.email, 'a@b.com');
    assert.equal(merged.returnReason, 'too_small');
  });

  it('getMissingFields requires both identity fields', () => {
    assert.deepEqual(
      getMissingFields('track_order', 'collect_identity', { orderNumber: '1001', email: null }),
      ['email'],
    );
    assert.deepEqual(
      getMissingFields('return_request', 'collect_identity', {
        orderNumber: '1001',
        email: 'a@b.com',
      }),
      [],
    );
  });

  it('applyExtractedToWorkflow persists across turns', () => {
    const session = {
      workflowState: {},
      pendingOrderNumber: undefined,
      orderLookupEmail: undefined,
      markModified() {},
    };
    applyExtractedToWorkflow(session, { orderNumber: '1001', email: null }, {
      intent: 'order_status',
      workflow: 'track_order',
      step: 'collect_identity',
    });
    assert.equal(session.workflowState.collectedFields.orderNumber, '1001');
    assert.deepEqual(session.workflowState.missingFields, ['email']);

    applyExtractedToWorkflow(session, { orderNumber: null, email: 'a@b.com' }, {
      intent: 'order_status',
      workflow: 'track_order',
      step: 'collect_identity',
    });
    assert.equal(session.workflowState.collectedFields.orderNumber, '1001');
    assert.equal(session.workflowState.collectedFields.email, 'a@b.com');
    assert.deepEqual(session.workflowState.missingFields, []);
  });
});

describe('safe handoff messaging', () => {
  it('never exposes dollar thresholds', () => {
    const msg = getSafeHandoffMessage('refund_amount_exceeds_ai_limit');
    assert.equal(/\$\d+|over \$\d+/i.test(msg), false);
    assert.match(msg, /support team/i);
  });
});

describe('handoff cancel', () => {
  it('detects cancel and accept phrases', () => {
    assert.equal(wantsCancelHandoff('No, please keep helping me here'), true);
    assert.equal(wantsAcceptHandoff('Yes, please connect me with an agent'), true);
  });

  it('cancels pending handoff and resumes AI', async () => {
    const session = {
      status: 'waiting_human',
      assignedAgent: null,
      handoffState: {
        ...defaultHandoffState(),
        status: HANDOFF_STATUSES.WAITING_FOR_AGENT,
        activeResponder: ACTIVE_RESPONDERS.QUEUED,
        version: 2,
      },
      markModified() {},
      async save() {
        return this;
      },
    };

    assert.equal(isHandoffPending(session), true);
    const result = await cancelHandoffByCustomer(session);
    assert.equal(result.ok, true);
    assert.equal(session.handoffState.status, HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER);
    assert.equal(session.handoffState.activeResponder, ACTIVE_RESPONDERS.AI);
    assert.equal(session.status, 'active');
    assert.equal(isHandoffPending(session), false);
  });

  it('offerHandoff sets offered without queueing', () => {
    const session = {
      handoffState: defaultHandoffState(),
      markModified() {},
    };
    const copy = offerHandoff(session, 'refund_amount_exceeds_ai_limit');
    assert.equal(session.handoffState.status, HANDOFF_STATUSES.OFFERED);
    assert.equal(session.handoffState.activeResponder, ACTIVE_RESPONDERS.AI);
    assert.equal(/\$\d+/.test(copy), false);
  });
});
