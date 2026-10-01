import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Button, Card, CardContent, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import { devicesActions, sessionActions } from '../../../store';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import usePositionAttributes from '../../../common/attributes/usePositionAttributes';
import useVehicles from '../../common/useVehicles';
import { useUnits } from '../../common/format';
import useT from '../../common/useT';
import { defaultLayout, widgetTitle, widgetTypes } from './widgets';
import WidgetDialog from './WidgetDialog';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
  grid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
  },
  small: {
    gridColumn: 'span 3',
    [theme.breakpoints.down('md')]: {
      gridColumn: 'span 6',
    },
    [theme.breakpoints.down('sm')]: {
      gridColumn: 'span 12',
    },
  },
  medium: {
    gridColumn: 'span 6',
    [theme.breakpoints.down('lg')]: {
      gridColumn: 'span 12',
    },
  },
  large: {
    gridColumn: 'span 12',
  },
  widget: {
    height: '100%',
  },
  editing: {
    outline: `1px dashed ${theme.palette.divider}`,
  },
  dropTarget: {
    outline: `2px solid ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  handle: {
    cursor: 'grab',
    color: theme.palette.text.secondary,
  },
}));

const layoutKey = 'v2Dashboard';
const summaryRefresh = 5 * 60 * 1000;

const parseLayout = (user) => {
  try {
    const layout = JSON.parse(user.attributes[layoutKey] || 'null');
    return Array.isArray(layout) ? layout.filter((widget) => widgetTypes[widget.type]) : null;
  } catch {
    return null;
  }
};

const newId = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Admin dashboard made of widgets the Admin can add, configure, reorder and resize.
// The layout is stored in the Admin's user attributes.
const DashboardPage = () => {
  const { classes, cx } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const positionAttributes = usePositionAttributes(sharedT);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { distanceUnit } = useUnits();

  const user = useSelector((state) => state.session.user);
  const savedLayout = useMemo(() => parseLayout(user) || defaultLayout, [user]);

  const [editing, setEditing] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const layout = editing || savedLayout;

  const { vehicles, counts } = useVehicles('', 'all');
  const events = useSelector((state) => state.events.items);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Today's summary feeds several widgets; refetched when the vehicle set changes.
  const deviceIdsKey = vehicles.map((vehicle) => vehicle.device.id).join(',');
  const [summary, setSummary] = useState(null);
  const [summaryTick, setSummaryTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSummaryTick((tick) => tick + 1), summaryRefresh);
    return () => clearInterval(interval);
  }, []);

  useAsyncTask(
    async ({ signal }) => {
      void summaryTick;
      if (!deviceIdsKey) {
        setSummary([]);
        return;
      }
      const query = new URLSearchParams({
        from: dayjs().startOf('day').toISOString(),
        to: dayjs().toISOString(),
      });
      deviceIdsKey.split(',').forEach((id) => query.append('deviceId', id));
      const response = await fetchOrThrow(`/api/reports/summary?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      setSummary(await response.json());
    },
    [deviceIdsKey, summaryTick],
  );

  const openVehicle = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
  };

  const data = {
    t,
    sharedT,
    vehicles,
    counts,
    summary,
    events,
    now,
    distanceUnit,
    openVehicle,
  };

  const move = (from, to) => {
    if (from === to || to < 0 || to >= editing.length) return;
    const next = [...editing];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setEditing(next);
  };

  const handleSave = useCatch(async () => {
    const response = await fetchOrThrow(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...user,
        attributes: { ...user.attributes, [layoutKey]: JSON.stringify(editing) },
      }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
    setEditing(null);
  });

  const saveWidget = (config) => {
    setEditing(
      config.id && editing.some((widget) => widget.id === config.id)
        ? editing.map((widget) => (widget.id === config.id ? config : widget))
        : [...editing, { ...config, id: newId() }],
    );
    setDialog(null);
  };

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        {editing ? (
          <>
            <Button startIcon={<AddIcon />} onClick={() => setDialog({ widget: null })}>
              {t('widgetAdd')}
            </Button>
            <Button startIcon={<RestartAltIcon />} onClick={() => setEditing(defaultLayout)}>
              {t('widgetReset')}
            </Button>
            <Button startIcon={<CloseIcon />} onClick={() => setEditing(null)}>
              {t('cancel')}
            </Button>
            <Button variant="contained" startIcon={<CheckIcon />} onClick={handleSave}>
              {t('save')}
            </Button>
          </>
        ) : (
          <Button startIcon={<EditIcon />} onClick={() => setEditing(savedLayout)}>
            {t('widgetCustomize')}
          </Button>
        )}
      </div>

      <div className={classes.grid}>
        {layout.map((widget, index) => {
          const Widget = widgetTypes[widget.type].component;
          return (
            <Card
              key={widget.id}
              variant="outlined"
              className={cx(
                classes[widget.size] || classes.medium,
                editing && classes.editing,
                editing && overIndex === index && dragIndex !== index && classes.dropTarget,
              )}
              draggable={Boolean(editing)}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                if (editing) {
                  e.preventDefault();
                  setOverIndex(index);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                move(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              <CardContent className={classes.widget}>
                <div className={classes.header}>
                  {editing && <DragIndicatorIcon fontSize="small" className={classes.handle} />}
                  <Typography
                    variant={widget.type === 'stat' ? 'body2' : 'subtitle1'}
                    color={widget.type === 'stat' ? 'textSecondary' : 'textPrimary'}
                    fontWeight={widget.type === 'stat' ? 400 : 600}
                    noWrap
                    className={classes.title}
                  >
                    {widgetTitle(widget, t, positionAttributes)}
                  </Typography>
                  {editing && (
                    <>
                      <Tooltip title={t('widgetMoveUp')}>
                        <IconButton size="small" onClick={() => move(index, index - 1)}>
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('widgetMoveDown')}>
                        <IconButton size="small" onClick={() => move(index, index + 1)}>
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('widgetEdit')}>
                        <IconButton size="small" onClick={() => setDialog({ widget })}>
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('remove')}>
                        <IconButton
                          size="small"
                          onClick={() => setEditing(editing.filter((it) => it.id !== widget.id))}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </div>
                <Widget config={widget} data={data} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      {layout.length === 0 && <Typography color="textSecondary">{t('widgetEmpty')}</Typography>}

      {dialog && (
        <WidgetDialog widget={dialog.widget} onClose={() => setDialog(null)} onSave={saveWidget} />
      )}
    </div>
  );
};

export default DashboardPage;
