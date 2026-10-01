import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getImpersonation } from './impersonation';

// Only trust the stored SuperAdmin token while the session really is that company's Admin.
const useImpersonation = () => {
  const userId = useSelector((state) => state.session.user?.id);
  return useMemo(() => {
    const impersonation = getImpersonation();
    return impersonation && impersonation.company.id === userId ? impersonation : null;
  }, [userId]);
};

export default useImpersonation;
