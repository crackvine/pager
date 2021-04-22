const pagerService = require('./pager.js');

describe('alert tests', () => {
  const escalationPolicyAdapter = {
    getTargets: jest.fn(() => ([
      { id: 7, type: 'sms', target: '+3456556' },
      { id: 3, type: 'email', target: 'fp@work.com' }]
    )),
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

  test('alert flags a service as unhealthy', () => {
    const pager = pagerService({
      escalationPolicyAdapter, smsAdapter, emailAdapter, timerAdapter,
    });
    pager.alert(1000);

    expect(pager.serviceStatus(1000)).toEqual({
      acknowledged: false,
      healthy: false,
      level: 0,
    });
  });

  test('alert calls the escalationPolicyAdapter with expected params', () => {
    const pager = pagerService({
      escalationPolicyAdapter, smsAdapter, emailAdapter, timerAdapter,
    });
    pager.alert(1000);

    expect(escalationPolicyAdapter.getTargets).toHaveBeenCalledWith(1000, 0);
  });

  test('alert calls sms and email adapters with expected params', async () => {
    const pager = pagerService({
      escalationPolicyAdapter, smsAdapter, emailAdapter, timerAdapter,
    });
    await pager.alert(1000);

    expect(smsAdapter.notify).toHaveBeenCalledWith('+3456556');
    expect(emailAdapter.notify).toHaveBeenCalledWith('fp@work.com');
  });

  test('alert notifies targets', async () => {
    const pager = pagerService({
      escalationPolicyAdapter, smsAdapter, emailAdapter, timerAdapter,
    });
    await pager.alert(1000);

    expect(pager.notificationStatus()).toEqual(new Set([3, 7]));
  });

  test('multiple alerts should not re-notify', () => {
    const pager = pagerService({
      escalationPolicyAdapter, smsAdapter, emailAdapter, timerAdapter,
    });
    pager.alert(1000);
    pager.alert(2000);
    pager.alert(3000);
    pager.alert(1000);
    pager.alert(1000);

    expect(smsAdapter.notify.mock.calls.length).toBe(2);
    expect(emailAdapter.notify.mock.calls.length).toBe(2);
  });
});
