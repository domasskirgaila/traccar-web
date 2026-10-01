import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sessionActions } from '../../../store';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'start',
    [theme.breakpoints.up('lg')]: {
      gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  grow: {
    flex: 1,
  },
  info: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1.5),
  },
  table: {
    overflowX: 'auto',
    maxHeight: 360,
  },
}));

const statisticsColumns = [
  ['activeUsers', 'statisticsActiveUsers'],
  ['activeDevices', 'statisticsActiveDevices'],
  ['requests', 'statisticsRequests'],
  ['messagesReceived', 'statisticsMessagesReceived'],
  ['messagesStored', 'statisticsMessagesStored'],
  ['geocoderRequests', 'statisticsGeocoder'],
];

// SuperAdmin system tools: server facts, usage statistics and a few server-wide settings.
const SystemPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();

  const server = useSelector((state) => state.session.server);
  const [days, setDays] = useState(7);
  const [statistics, setStatistics] = useState(null);
  const [announcement, setAnnouncement] = useState(server.announcement || '');
  const [registration, setRegistration] = useState(Boolean(server.registration));
  const [saved, setSaved] = useState(false);

  useAsyncTask(
    async ({ signal }) => {
      setStatistics(null);
      const query = new URLSearchParams({
        from: dayjs().subtract(days, 'day').startOf('day').toISOString(),
        to: dayjs().toISOString(),
      });
      const response = await fetchOrThrow(`/api/statistics?${query.toString()}`, { signal });
      setStatistics(await response.json());
    },
    [days],
  );

  const chartData = useMemo(
    () =>
      (statistics || []).map((item) => ({
        day: dayjs(item.captureTime).format('MM-DD'),
        messages: item.messagesStored,
      })),
    [statistics],
  );

  const handleSave = useCatch(async () => {
    const response = await fetchOrThrow('/api/server', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...server, announcement: announcement || null, registration }),
    });
    dispatch(sessionActions.updateServer(await response.json()));
    setSaved(true);
  });

  const yesNo = (value) => (value ? sharedT('sharedYes') : sharedT('sharedNo'));

  return (
    <div className={classes.root}>
      <div className={classes.column}>
        <Card variant="outlined">
          <CardContent>
            <div className={classes.header}>
              <Typography variant="subtitle1" fontWeight={600} className={classes.grow}>
                {t('systemStatistics')}
              </Typography>
              <TextField select size="small" value={days} onChange={(e) => setDays(e.target.value)}>
                {[7, 30, 90].map((value) => (
                  <MenuItem key={value} value={value}>
                    {`${value} ${t('widgetDaysUnit')}`}
                  </MenuItem>
                ))}
              </TextField>
            </div>
            <Typography variant="caption" color="textSecondary">
              {sharedT('statisticsMessagesStored')}
            </Typography>
            {statistics && statistics.length === 0 ? (
              <Typography color="textSecondary">{t('systemNoStatistics')}</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                    stroke={theme.palette.divider}
                  />
                  <YAxis
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                    stroke={theme.palette.divider}
                    width={64}
                  />
                  <Tooltip
                    cursor={{ fill: theme.palette.action.hover }}
                    formatter={(value) => [value, sharedT('statisticsMessagesStored')]}
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.primary,
                    }}
                  />
                  <Bar dataKey="messages" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Paper variant="outlined" className={classes.table}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t('systemDay')}</TableCell>
                {statisticsColumns.map(([key, titleKey]) => (
                  <TableCell key={key} align="right">
                    {sharedT(titleKey)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[...(statistics || [])].reverse().map((item) => (
                <TableRow key={item.id ?? item.captureTime} hover>
                  <TableCell>{dayjs(item.captureTime).format('YYYY-MM-DD')}</TableCell>
                  {statisticsColumns.map(([key]) => (
                    <TableCell key={key} align="right">
                      {item[key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </div>

      <div className={classes.column}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600}>
              {t('systemServer')}
            </Typography>
            <div className={classes.info}>
              <Typography color="textSecondary">{t('systemVersion')}</Typography>
              <Typography>{server.version}</Typography>
              <Typography color="textSecondary">{t('systemWebVersion')}</Typography>
              <Typography>{import.meta.env.VITE_APP_VERSION}</Typography>
              <Typography color="textSecondary">{t('systemEmail')}</Typography>
              <Typography>{yesNo(server.emailEnabled)}</Typography>
              <Typography color="textSecondary">{t('systemSms')}</Typography>
              <Typography>{yesNo(server.textEnabled)}</Typography>
              <Typography color="textSecondary">{t('systemGeocoder')}</Typography>
              <Typography>{yesNo(server.geocoderEnabled)}</Typography>
              <Typography color="textSecondary">OpenID</Typography>
              <Typography>{yesNo(server.openIdEnabled)}</Typography>
            </div>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600}>
              {t('systemSettings')}
            </Typography>
            <div className={classes.form}>
              <TextField
                multiline
                minRows={2}
                label={t('systemAnnouncement')}
                helperText={t('systemAnnouncementHint')}
                value={announcement}
                onChange={(e) => {
                  setSaved(false);
                  setAnnouncement(e.target.value);
                }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={registration}
                    onChange={(e) => {
                      setSaved(false);
                      setRegistration(e.target.checked);
                    }}
                  />
                }
                label={t('systemRegistration')}
              />
              {saved && <Alert severity="success">{t('settingsSaved')}</Alert>}
              <Button variant="contained" onClick={handleSave}>
                {t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemPage;
