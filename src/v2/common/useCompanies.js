import { useState } from 'react';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { isCompany } from './roles';

// Company names only (Admin users), for SuperAdmin and Installer company pickers.
const useCompanies = () => {
  const [companies, setCompanies] = useState(null);

  useAsyncTask(async ({ signal }) => {
    const response = await fetchOrThrow('/api/users', { signal });
    const users = await response.json();
    setCompanies(
      users.filter(isCompany).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    );
  }, []);

  return companies;
};

export default useCompanies;
