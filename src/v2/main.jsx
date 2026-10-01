import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { CssBaseline, StyledEngineProvider } from '@mui/material';
import store from '../store';
import { LocalizationProvider } from '../common/components/LocalizationProvider';
import ErrorHandler from '../common/components/ErrorHandler';
import NativeInterface from '../common/components/NativeInterface';
import ServerProvider from '../ServerProvider';
import ErrorBoundary from '../ErrorBoundary';
import ThemeProvider from './theme/ThemeProvider';
import Navigation from './Navigation';

// Starts preparing map icons right away, like the old UI, without bundling the map engine.
import './common/mapImages';

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <Provider store={store}>
      <LocalizationProvider>
        <StyledEngineProvider injectFirst>
          <ThemeProvider>
            <CssBaseline />
            <ServerProvider>
              <BrowserRouter>
                <Navigation />
              </BrowserRouter>
              <ErrorHandler />
              <NativeInterface />
            </ServerProvider>
          </ThemeProvider>
        </StyledEngineProvider>
      </LocalizationProvider>
    </Provider>
  </ErrorBoundary>,
);
