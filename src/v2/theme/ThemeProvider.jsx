import { createContext, use, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider as MuiThemeProvider, createTheme, useMediaQuery } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import palette from '../../common/theme/palette';
import dimensions from '../../common/theme/dimensions';
import components from '../../common/theme/components';
import { useLocalization } from '../../common/components/LocalizationProvider';
import usePersistedState from '../../common/util/usePersistedState';

const cache = {
  ltr: createCache({ key: 'muiltr', stylisPlugins: [prefixer] }),
  rtl: createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] }),
};

export const themeModes = ['light', 'dark', 'system'];

const ThemeModeContext = createContext({ mode: 'system', setMode: () => {} });

export const useThemeMode = () => use(ThemeModeContext);

const ThemeProvider = ({ children }) => {
  const server = useSelector((state) => state.session.server);
  const { direction } = useLocalization();

  const [mode, setMode] = usePersistedState('v2ThemeMode', 'system');
  const preferDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const darkMode = mode === 'system' ? preferDarkMode : mode === 'dark';

  const theme = useMemo(
    () =>
      createTheme({
        typography: {
          fontFamily: 'Roboto,Segoe UI,Helvetica Neue,Arial,sans-serif',
        },
        shape: { borderRadius: 8 },
        palette: palette(server, darkMode),
        direction,
        dimensions: { ...dimensions, sidebarWidthV2: 240 },
        components,
      }),
    [server, darkMode, direction],
  );

  const modeValue = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ThemeModeContext value={modeValue}>
      <CacheProvider value={cache[direction]}>
        <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
      </CacheProvider>
    </ThemeModeContext>
  );
};

export default ThemeProvider;
