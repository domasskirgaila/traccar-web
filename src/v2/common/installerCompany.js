// The company an Installer adds equipment to. Kept per browser tab.
const key = 'v2InstallerCompany';

export const getInstallerCompany = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
};

export const setInstallerCompany = (company) => {
  window.sessionStorage.setItem(key, JSON.stringify({ id: company.id, name: company.name }));
};
