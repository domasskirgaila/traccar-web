import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button, Card, Chip, Collapse, IconButton, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import TerminalIcon from '@mui/icons-material/Terminal';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PositionValue from '../../../common/components/PositionValue';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import usePositionAttributes from '../../../common/attributes/usePositionAttributes';
import StatusDot from '../../common/StatusDot';
import { vehicleStatus } from '../../common/useVehicles';
import {
  formatDistanceShort,
  formatRelative,
  formatSpeedShort,
  useUnits,
} from '../../common/format';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  card: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '60vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 1, 1, 2),
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  body: {
    overflow: 'auto',
    padding: theme.spacing(0, 2, 1),
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: theme.spacing(1),
  },
  metric: {
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
  },
  io: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    columnGap: theme.spacing(3),
    marginTop: theme.spacing(1),
  },
  ioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2, 1.5),
  },
}));

const statusColors = { online: 'success', offline: 'error', unknown: 'default' };
const statusTitleKeys = {
  online: 'statusOnline',
  offline: 'statusOffline',
  unknown: 'statusUnknown',
};

// Attributes already shown as metrics or not useful to a fleet user.
const hiddenAttributes = new Set(['motion', 'distance', 'totalDistance', 'raw']);

const Metric = ({ label, children }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.metric}>
      <Typography variant="caption" color="textSecondary" component="div">
        {label}
      </Typography>
      <Typography variant="subtitle1" fontWeight={600} noWrap>
        {children}
      </Typography>
    </div>
  );
};

const VehiclePanel = ({ device, position, onClose, onCenter }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const navigate = useNavigate();
  const positionAttributes = usePositionAttributes(sharedT);
  const { speedUnit, distanceUnit } = useUnits();
  const readonly = useSelector((state) => state.session.user.readonly);

  const [ioOpen, setIoOpen] = useState(false);

  const status = vehicleStatus(device);
  const attributes = position?.attributes || {};
  const odometer = attributes.odometer ?? attributes.totalDistance;

  return (
    <Card elevation={6} className={classes.card}>
      <div className={classes.header}>
        <StatusDot device={device} size={12} />
        <div className={classes.title}>
          <Typography variant="h6" noWrap>
            {device.name}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {`${t('vehicleLastUpdate')}: ${formatRelative(device.lastUpdate) ?? '—'}`}
          </Typography>
        </div>
        <Chip size="small" color={statusColors[status]} label={t(statusTitleKeys[status])} />
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      <div className={classes.body}>
        {position ? (
          <>
            <div className={classes.metrics}>
              <Metric label={t('speed')}>{formatSpeedShort(position.speed, speedUnit, t)}</Metric>
              {attributes.ignition !== undefined && (
                <Metric label={t('ignition')}>
                  {attributes.ignition ? t('ignitionOn') : t('ignitionOff')}
                </Metric>
              )}
              {attributes.fuel !== undefined && (
                <Metric label={t('fuel')}>
                  <PositionValue position={position} attribute="fuel" />
                </Metric>
              )}
              {attributes.power !== undefined && (
                <Metric label={t('power')}>
                  <PositionValue position={position} attribute="power" />
                </Metric>
              )}
              {odometer !== undefined && (
                <Metric label={t('odometer')}>
                  {formatDistanceShort(odometer, distanceUnit, t)}
                </Metric>
              )}
            </div>
            <Collapse in={ioOpen}>
              <div className={classes.io}>
                {Object.keys(attributes)
                  .filter((key) => !hiddenAttributes.has(key))
                  .sort()
                  .map((key) => (
                    <div key={key} className={classes.ioRow}>
                      <Typography variant="body2" color="textSecondary" noWrap>
                        {positionAttributes[key]?.name || key}
                      </Typography>
                      <Typography variant="body2" noWrap>
                        <PositionValue position={position} attribute={key} />
                      </Typography>
                    </div>
                  ))}
              </div>
            </Collapse>
          </>
        ) : (
          <Typography color="textSecondary">{t('vehicleNoData')}</Typography>
        )}
      </div>

      <div className={classes.actions}>
        {position && (
          <Button
            size="small"
            startIcon={ioOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setIoOpen(!ioOpen)}
          >
            {ioOpen ? t('hideIo') : t('allIo')}
          </Button>
        )}
        {position && (
          <Button size="small" startIcon={<CenterFocusStrongIcon />} onClick={onCenter}>
            {t('centerAction')}
          </Button>
        )}
        {!readonly && (
          <Button
            size="small"
            startIcon={<TerminalIcon />}
            onClick={() => navigate(`/commands?deviceId=${device.id}`)}
          >
            {t('commandsAction')}
          </Button>
        )}
        <Button size="small" startIcon={<HistoryIcon />} disabled>
          {t('historyAction')}
        </Button>
      </div>
    </Card>
  );
};

export default VehiclePanel;
