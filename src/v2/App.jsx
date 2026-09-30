import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import SocketController from '../SocketController';
import CachingController from '../CachingController';
import { useCatch, useAsyncTask } from '../reactHelper';
import { sessionActions } from '../store';
import TermsDialog from '../common/components/TermsDialog';
import Loader from '../common/components/Loader';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { ADMIN, USER, useRole } from './common/roles';
import Layout from './layout/Layout';

const App = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const newServer = useSelector((state) => state.session.server.newServer);
  const termsUrl = useSelector((state) => state.session.server.attributes.termsUrl);
  const user = useSelector((state) => state.session.user);
  const role = useRole();

  const acceptTerms = useCatch(async () => {
    const response = await fetchOrThrow(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, attributes: { ...user.attributes, termsAccepted: true } }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
  });

  useAsyncTask(
    async ({ signal }) => {
      if (!user) {
        const response = await fetch('/api/session', { signal });
        if (response.ok) {
          dispatch(sessionActions.updateUser(await response.json()));
        } else {
          window.sessionStorage.setItem(
            'postLogin',
            window.location.pathname + window.location.search,
          );
          navigate(newServer ? '/register' : '/login', { replace: true });
        }
      }
      return null;
    },
    [user, dispatch, navigate, newServer],
  );

  if (user == null) {
    return <Loader />;
  }
  if (termsUrl && !user.attributes.termsAccepted) {
    return <TermsDialog open onCancel={() => navigate('/login')} onAccept={() => acceptTerms()} />;
  }

  // Live fleet data is only loaded inside one company (User or Admin, including a SuperAdmin
  // viewing a company), never for the SuperAdmin or Installer company list.
  const fleetLoaded = role === USER || role === ADMIN;

  return (
    <>
      {fleetLoaded && <SocketController />}
      {fleetLoaded && <CachingController />}
      <Layout />
    </>
  );
};

export default App;
