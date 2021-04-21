const pagerService = require('./pager.js');

console.log(pagerService);

test('alert calls the escalationPolicyAdapter with expected params', () => {
  const escalationPolicyAdapter = {
    getTargets: jest.fn(() => ([
      { id: 7, type: 'sms', target: '+3456556' },
      { id: 3, type: 'email', target: 'fp@work.com' }]
    )),
  };

  const smsAdapter = {
    notify: jest.fn(() => {}),
  };

  const emailAdapter = {
    notify: jest.fn(() => {}),
  };

  const pager = pagerService({ escalationPolicyAdapter, smsAdapter, emailAdapter });
  pager.alert(1000);

  expect(escalationPolicyAdapter.getTargets).toHaveBeenCalledWith(1000, 0);
});
