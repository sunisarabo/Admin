const admin = require('firebase-admin');

async function sendDelayNotification(flight) {
  const message = {
    notification: {
      title: `Flight Delay: ${flight.flightNo}`,
      body: `New time: ${flight.newTime}`
    },
    topic: 'ops'
  };

  await admin.messaging().send(message);
}

module.exports = { sendDelayNotification };