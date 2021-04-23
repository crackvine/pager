const config = {
  ackTimeoutMinutes: 15,
};

const sleep = (msDelay) => new Promise((resolve) => setTimeout(resolve, msDelay));

const pagerService = ({
  escalationPolicyAdapter, timerAdapter, smsAdapter, emailAdapter, logger,
}) => {
  const monitoredServices = {};
  const notifiedTargets = new Set();
  const semaphores = new Set();

  const notify = async (targets) => {
    while (semaphores.has('notify')) {
      await sleep(50); // eslint-disable-line no-await-in-loop
    }

    semaphores.add('notify');

    const notifsSent = await Promise.all(
      targets.map(async (target) => {
        if (notifiedTargets.has(target.id)) {
          return 0;
        }

        logger.line(`notifying: ${target.target} of type ${target.type}`);
        let notifySuccess = false;
        if (target.type === 'sms') notifySuccess = await smsAdapter.notify(target.target);
        if (target.type === 'email') notifySuccess = await emailAdapter.notify(target.target);
        if (notifySuccess) {
          notifiedTargets.add(target.id);
          return 1;
        }
        return 0;
      }),
    );

    semaphores.delete('notify');

    const notifiedTargetCount = notifsSent.reduce((acc, sent) => acc + sent, 0);
    return notifiedTargetCount;
  };

  const alert = async (serviceId) => {
    logger.line(`alert received for service ${serviceId}`);

    if (!monitoredServices[serviceId] || monitoredServices[serviceId].healthy) {
      logger.line(`${serviceId} now unhealthy`);
      monitoredServices[serviceId] = {
        level: 0,
        healthy: false,
        acknowledged: false,
      };

      const targets = await escalationPolicyAdapter.getTargets(serviceId, 0);

      logger.line(`notifying targets ${JSON.stringify(targets)} for service ${serviceId}`);
      const notified = await notify(targets);
      if (notified) {
        logger.line(`setting timer for service ${serviceId}`);
        timerAdapter.setTimer(serviceId, config.ackTimeoutMinutes);
      }
    }
  };

  const acknowledge = (targetId, serviceId) => {
    logger.line(`service ${serviceId} acknowledged by target ${targetId}`);
    if (notifiedTargets.has(targetId)) notifiedTargets.delete(targetId);

    if (monitoredServices[serviceId]) {
      logger.line(`setting acknowledgement for service ${serviceId}`);
      monitoredServices[serviceId].acknowledged = true;
    }
  };

  const timeout = async (serviceId) => {
    if (!monitoredServices[serviceId]
      || monitoredServices[serviceId].healthy
      || monitoredServices[serviceId].acknowledged) return;

    logger.line(`timeout received for unhealthy service ${serviceId}`);
    const maxLevel = escalationPolicyAdapter.getLevels(serviceId).length;
    if (monitoredServices[serviceId] && monitoredServices[serviceId].level < maxLevel) {
      monitoredServices[serviceId].level += 1;
      logger.line(`service ${serviceId} escalated to ${monitoredServices[serviceId].level}`);

      const targets = await escalationPolicyAdapter.getTargets(serviceId, monitoredServices[serviceId].level);
      logger.line('escalated targets', targets);
      const notified = await notify(targets);
      logger.line(`notified ${notified} escalated targets`);

      if (notified) {
        logger.line(`Setting timer for service ${serviceId}`);
        timerAdapter.setTimer(serviceId, config.ackTimeoutMinutes);
      }
    }
  };

  const clear = (serviceId) => {
    if (!monitoredServices[serviceId]) return;
    logger.line(`clearing status for service ${serviceId}`);
    monitoredServices[serviceId].level = 0;
    monitoredServices[serviceId].healthy = true;
    monitoredServices[serviceId].acknowledged = false;
  };

  const clearAll = () => {
    logger.line('clearing all status');
    for (const id in monitoredServices) {
      if ({}.hasOwnProperty.call(monitoredServices, id)) {
        monitoredServices[id] = null;
      }
    }
    notifiedTargets.clear();
  };

  const serviceStatus = (serviceId) => (serviceId ? monitoredServices[serviceId] : monitoredServices);

  const notificationStatus = () => notifiedTargets;

  return {
    alert,
    acknowledge,
    timeout,
    clear,
    clearAll,
    serviceStatus,
    notificationStatus,
  };
};

module.exports = pagerService;
