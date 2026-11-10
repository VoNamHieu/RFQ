import {DEMO_MODE} from './config.js';
import {qsFetch} from './http.js';

let demoStatus = {status: 'none'};
const wait = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getRegistration() {
  if (DEMO_MODE) {
    await wait();
    return demoStatus;
  }
  return qsFetch('/api/customer/registration');
}

export async function submitRegistration(payload) {
  if (DEMO_MODE) {
    await wait();
    demoStatus = {
      status: 'pending',
      application: {
        id: 'APP-4282',
        legalName: payload.legalName,
        submittedAt: '2026-09-22',
      },
    };
    return demoStatus;
  }

  return qsFetch('/api/customer/registration', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
