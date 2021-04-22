const config = {
  ackTimeoutMinutes: 15,
};

const wait = (msDelay) => new Promise((resolve) => setTimeout(resolve, msDelay));

const pagerService = (dependencies) => {
  const monitoredServices = {};
  const notifiedTargets = new Set();
  const semaphores = new Set();

  const {
    escalationPolicyAdapter,
    timerAdapter,
    smsAdapter,
    emailAdapter,
  } = dependencies;

  const notify = async (targets) => {
    while (semaphores.has('notify')) {
      await wait(200);
    }
    semaphores.add('notify');

    let notifiedTargetCount = 0;
    await Promise.all(
      targets.map(async (target) => {
        if (notifiedTargets.has(target.id)) return;

        let notifySuccess = false;
        if (target.type === 'sms') notifySuccess = await smsAdapter.notify(target.target);
        if (target.type === 'email') notifySuccess = await emailAdapter.notify(target.target);
        if (notifySuccess) {
          notifiedTargets.add(target.id);
          notifiedTargetCount += 1;
        }
      }),
    );

    semaphores.delete('notify');
    return notifiedTargetCount;
  };

  const alert = async (serviceId) => {
    if (!monitoredServices[serviceId] || monitoredServices[serviceId].healthy) {
      monitoredServices[serviceId] = {
        level: 0,
        healthy: false,
        acknowledged: false,
      };

      const targets = escalationPolicyAdapter.getTargets(serviceId, 0);
      const notified = await notify(targets);
      if (notified) {
        timerAdapter.setTimer(serviceId, config.ackTimeoutMinutes);
      }
    }
  };

  const acknowledge = (targetId, serviceId) => {
    if (notifiedTargets.has(targetId)) notifiedTargets.delete(targetId);

    if (monitoredServices[serviceId]) {
      monitoredServices[serviceId].acknowledged = true;
    }
  };

  const timeout = async (serviceId) => {
    if (monitoredServices[serviceId].healthy || monitoredServices[serviceId].acknowledged) return;

    const maxLevel = escalationPolicyAdapter.getLevels(serviceId).length;
    if (monitoredServices[serviceId] && monitoredServices[serviceId].level < maxLevel) {
      monitoredServices[serviceId].level += 1;
      const targets = escalationPolicyAdapter.getTargets(serviceId, monitoredServices[serviceId].level);
      const notified = await notify(targets);
      if (notified) {
        timerAdapter.setTimer(serviceId, config.ackTimeoutMinutes);
      }
    }
  };

  const clear = (serviceId) => {
    monitoredServices[serviceId] = {
      level: 0,
      healthy: true,
      acknowledged: false,
    };
  };

  const serviceStatus = (serviceId) => (serviceId ? monitoredServices[serviceId] : monitoredServices);

  const notificationStatus = () => notifiedTargets;

  return {
    alert,
    acknowledge,
    timeout,
    clear,
    serviceStatus,
    notificationStatus,
  };
};

module.exports = pagerService;
