# pager service

This pager service provides a simple management of alerts and notifications for the monitored services.

The state of the monitored services and targets notified is stored in memory. In a real scenario this state tracking could be provided by a persistence service.

In relation to the database adapter, it could also be used as an event sourcing store for later generation of statistical projections.

Improvements would be to include handling of errors/failure in the dependencies, logging to a database, including timestamp tracking to ensure older events do not override newer ones

### Usage

`npm install`

`npm run test`


```
const pagerService = require('./pager.js');
const pager = pagerService({
  escalationPolicyAdapter, smsAdapter, emailAdapter, timerAdapter, logger,
});
```

The service exposes the following methods:

`alert(SERVICE_ID)` : (async) notify the pager of an alert for a service

`acknowledge(TARGET_ID, SERVICE_ID)` : acknowledge the alert for a service by a target

`timeout(SERVICE_ID)` : (async) notify of timer timeout for a service

`clear(SERVICE_ID)` : notify of healthy status for a service

`serviceStatus(SERVICE_ID)` : provides current status of the services

`notificationStatus()` : provides current notification status

`clearAll()` : clear all alerts and notification status


---

### Dependencies

The pager service has the following dependencies:

`escalationPolicyAdapter` exposes two methods:
- **getTargets(SERVICE_ID, ESCALATION_LEVEL)** returns an array of target data (type and contact) for a particular level
- **getLevels(SERVICE_ID)** returns an ordered list of levels

`smsAdapter` exposes a single method **notify(NUMBER)** which returns true on notification sent 

`emailAdapter` exposes a single method **notify(EMAIL)** which returns true on notification sent

`timerAdapter` exposes a single method **setTimer(SERVICE_ID, TIMEOUT_MINUTES)** which return true on setting timer correctly

`logger` exposes a single method **line(TEXT)** 


