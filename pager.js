const config = {
  ackTimeoutMinutes: 15,
};

const pagerService = (dependencies) => {
  const monitoredServices = {};
  const notifiedTargets = new Set();

  const {
    escalationPolicyAdapter,
    timerAdapter,
    smsAdapter,
    emailAdapter,
  } = dependencies;

  const notify = async (targets) => {
    let notifiedTargetCount = 0;

    targets.forEach((target) => {
      if (notifiedTargets.has(target.id)) return;

      let notifySuccess = false;
      if (target.type === 'sms') notifySuccess = smsAdapter.notify(target.number);
      if (target.type === 'email') notifySuccess = emailAdapter.notify(target.email);
      if (notifySuccess) {
        notifiedTargets.add(target.id);
        notifiedTargetCount += 1;
      }
    });

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

    console.debug(monitoredServices);
  };

  const acknowledge = (targetId, serviceId) => {
    if (notifiedTargets.has(targetId)) notifiedTargets.delete(targetId);

    if (monitoredServices[serviceId]) {
      monitoredServices[serviceId].acknowledged = true;
    }

    console.debug(monitoredServices);
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

    console.debug(monitoredServices);
  };

  const clear = (serviceId) => {
    monitoredServices[serviceId] = {
      level: 0,
      healthy: true,
      acknowledged: false,
    };

    console.debug(monitoredServices);
  };

  return {
    alert,
    acknowledge,
    timeout,
    clear,
  };
};

export default pagerService;
