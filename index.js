const pagerService = require('./pager.js');

console.log(pagerService);

const escalationPolicyAdapter = {
  getTargets: () => ([
    { id: 7, type: 'sms', target: '+3456556' },
    { id: 3, type: 'email', target: 'fp@work.com' }]
  ),
};

const smsAdapter = {
  notify: () => {},
};

const emailAdapter = {
  notify: () => {},
};

const pager = pagerService({ escalationPolicyAdapter, emailAdapter, smsAdapter });
pager.alert(1000);
