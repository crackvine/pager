const pagerService = require('./pager.js');

// Mock dependencies
const escalationPolicyAdapter = {
  getTargets: jest.fn((_, level = 0) => {
    const levels = [
      { targets: [{ id: 7, type: 'sms', target: '+3456556' }, { id: 3, type: 'email', target: 'fp@work.com' }] },
      { targets: [{ id: 6, type: 'email', target: 'fp@home.com' }, { id: 9, type: 'sms', target: '+34123232' }] },
    ];
    return levels[level].targets;
  }),
  getLevels: jest.fn(() => ([0, 1])),
};

const smsAdapter = {
  notify: jest.fn(() => true),
};

const emailAdapter = {
  notify: jest.fn(() => true),
};

const timerAdapter = {
  setTimer: jest.fn(() => true),
};

const logger = {
  // line: (line) => console.debug(line), // enable logging
  line: () => {}, // disable logging
};

// Instatiate pager service
const pager = pagerService({
  escalationPolicyAdapter, smsAdapter, emailAdapter, timerAdapter, logger,
});

describe('alert tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pager.clearAll();
  });

  test('alert flags a service as unhealthy', async () => {
    await pager.alert(1000);

    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: false,
      healthy: false,
      level: 0,
    });
  });

  test('alert calls the escalationPolicyAdapter with expected params', async () => {
    await pager.alert(1000);

    expect(escalationPolicyAdapter.getTargets).toHaveBeenCalledWith(1000, 0);
  });

  test('alert calls sms and email adapters with expected params', async () => {
    await pager.alert(1000);

    expect(smsAdapter.notify).toHaveBeenCalledWith('+3456556');
    expect(emailAdapter.notify).toHaveBeenCalledWith('fp@work.com');
  });

  test('alert notifies targets', async () => {
    await pager.alert(1000);

    expect(pager.notificationStatus()).toEqual(new Set([3, 7]));
  });

  test('multiple alerts should not re-notify the same targets', async () => {
    await Promise.all([
      pager.alert(1000),
      pager.alert(1000),
      pager.alert(1000),
      pager.alert(1000),
      pager.alert(1000),
    ]);
    expect(smsAdapter.notify.mock.calls.length).toBe(1);
    expect(emailAdapter.notify.mock.calls.length).toBe(1);
  });
});

describe('acknowledge tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pager.clearAll();
  });

  test('alert flagged as acknowledged', async () => {
    await pager.alert(1000);
    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: false,
      healthy: false,
      level: 0,
    });

    pager.acknowledge(7, 1000);

    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: true,
      healthy: false,
      level: 0,
    });
  });

  test('alert not flagged as acknowledged for incorrect serviceId', async () => {
    await pager.alert(1000);

    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: false,
      healthy: false,
      level: 0,
    });

    pager.acknowledge(7, 9999);

    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: false,
      healthy: false,
      level: 0,
    });
  });

  test('acknowledge resets target notified status', async () => {
    await pager.alert(1000);

    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: false,
      healthy: false,
      level: 0,
    });

    expect(pager.notificationStatus()).toEqual(new Set([3, 7]));

    pager.acknowledge(7, 1000);

    expect(pager.notificationStatus()).toEqual(new Set([3]));
  });
});

describe('timeout tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pager.clearAll();
  });

  test('timeout does nothing for a healthy service', async () => {
    await pager.alert(1000);
    pager.clear(1000);
    await pager.timeout(1000);

    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: false,
      healthy: true,
      level: 0,
    });
  });

  test('timeout does not notify targets for an acknowledged alert', async () => {
    await pager.alert(1000);
    pager.acknowledge(7, 1000);
    await pager.timeout(1000);

    expect(smsAdapter.notify.mock.calls.length).toBe(1);
    expect(emailAdapter.notify.mock.calls.length).toBe(1);
  });

  test('timeout calls the escalationPolicyAdapter with expected params', async () => {
    await pager.alert(1000);
    await pager.timeout(1000);

    expect(escalationPolicyAdapter.getLevels).toHaveBeenCalledWith(1000);
    expect(escalationPolicyAdapter.getTargets).toHaveBeenCalledWith(1000, 1);
  });

  test('timeout notifies escalated targets', async () => {
    await pager.alert(1000);
    await pager.timeout(1000);

    expect(emailAdapter.notify).toHaveBeenCalledWith('fp@home.com');
    expect(smsAdapter.notify).toHaveBeenCalledWith('+34123232');
  });
});
