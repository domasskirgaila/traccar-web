import dayjs from 'dayjs';
import fetchOrThrow from '../../common/util/fetchOrThrow';

// A SuperAdmin opens one company by logging in as its Admin, so the backend only sends
// that company's fleet. A short-lived SuperAdmin token is kept in sessionStorage to switch
// back. A real Admin never has this token, so it can never change company.

const tokenKey = 'v2ReturnToken';
const companyKey = 'v2ViewingCompany';

export const clearImpersonation = () => {
  window.sessionStorage.removeItem(tokenKey);
  window.sessionStorage.removeItem(companyKey);
};

export const getImpersonation = () => {
  try {
    const token = window.sessionStorage.getItem(tokenKey);
    const company = JSON.parse(window.sessionStorage.getItem(companyKey));
    return token && company ? { token, company } : null;
  } catch {
    return null;
  }
};

export const openCompanyFleet = async (company) => {
  const expiration = dayjs().add(12, 'hour').toISOString();
  const tokenResponse = await fetchOrThrow('/api/session/token', {
    method: 'POST',
    body: new URLSearchParams({ expiration }),
  });
  const token = await tokenResponse.text();
  window.sessionStorage.setItem(tokenKey, token);
  window.sessionStorage.setItem(companyKey, JSON.stringify({ id: company.id, name: company.name }));
  try {
    await fetchOrThrow(`/api/session/${company.id}`);
  } catch (error) {
    clearImpersonation();
    throw error;
  }
  window.location.replace('/');
};

export const returnToSuperAdmin = async () => {
  const impersonation = getImpersonation();
  clearImpersonation();
  await fetch('/api/session', { method: 'DELETE' });
  if (impersonation) {
    const response = await fetch(`/api/session?token=${encodeURIComponent(impersonation.token)}`);
    if (response.ok) {
      // Best effort: the token is no longer needed once the session is restored.
      fetch('/api/session/token/revoke', {
        method: 'POST',
        body: new URLSearchParams({ token: impersonation.token }),
      }).catch(() => {});
      window.location.replace('/companies');
      return;
    }
  }
  window.location.replace('/login');
};
