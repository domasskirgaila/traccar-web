import { useTheme } from '@mui/material/styles';
import { vehicleStatus } from './useVehicles';

const colors = {
  online: 'success',
  offline: 'error',
  unknown: 'neutral',
};

const StatusDot = ({ device, size = 10 }) => {
  const theme = useTheme();
  return (
    <span
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: theme.palette[colors[vehicleStatus(device)]].main,
      }}
    />
  );
};

export default StatusDot;
