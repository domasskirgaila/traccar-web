import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useCatch } from '../../../reactHelper';
import useT from '../../common/useT';
import { periodRange } from '../reports/reportTypes';

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
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  filter: {
    minWidth: 180,
    flex: '1 1 180px',
    maxWidth: 320,
  },
  table: {
    overflowX: 'auto',
    maxHeight: '70vh',
  },
  nowrap: {
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

const periods = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth'];
const periodTitleKeys = {
  today: 'periodToday',
  yesterday: 'periodYesterday',
  thisWeek: 'periodThisWeek',
  lastWeek: 'periodLastWeek',
  thisMonth: 'periodThisMonth',
};

const actionColors = {
  create: 'success',
  edit: 'info',
  remove: 'error',
  link: 'default',
  unlink: 'warning',
};
const displayLimit = 2000;

// SuperAdmin audit log: who changed what and when, across all companies.
const AuditPage = () => {
  const { classes } = useStyles();
  const t = useT();

  const [period, setPeriod] = useState('today');
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('all');
  const [user, setUser] = useState(null);
  const [hideLogins, setHideLogins] = useState(true);

  const load = useCatch(async () => {
    const [from, to] = periodRange(period);
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/audit?${query.toString()}`);
      setItems((await response.json()).reverse());
    } finally {
      setLoading(false);
    }
  });

  const actions = useMemo(
    () => [...new Set((items || []).map((item) => item.actionType))].sort(),
    [items],
  );
  const users = useMemo(
    () => [...new Set((items || []).map((item) => item.userEmail || String(item.userId)))].sort(),
    [items],
  );

  const filtered = useMemo(
    () =>
      (items || []).filter(
        (item) =>
          (!hideLogins || (item.actionType !== 'login' && item.actionType !== 'logout')) &&
          (action === 'all' || item.actionType === action) &&
          (!user || (item.userEmail || String(item.userId)) === user),
      ),
    [items, hideLogins, action, user],
  );

  return (
    <div className={classes.root}>
      <div className={classes.filters}>
        <TextField
          select
          className={classes.filter}
          label={t('reportsPeriod')}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {periods.map((value) => (
            <MenuItem key={value} value={value}>
              {t(periodTitleKeys[value])}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={load}>
          {t('eventsShow')}
        </Button>
        {items && (
          <>
            <TextField
              select
              className={classes.filter}
              label={t('auditAction')}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <MenuItem value="all">{t('usersFilterAll')}</MenuItem>
              {actions.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              className={classes.filter}
              options={users}
              value={user}
              onChange={(_, value) => setUser(value)}
              renderInput={(params) => <TextField {...params} label={t('auditUser')} />}
            />
            <FormControlLabel
              control={
                <Checkbox checked={hideLogins} onChange={(e) => setHideLogins(e.target.checked)} />
              }
              label={t('auditHideLogins')}
            />
          </>
        )}
      </div>

      {loading && <CircularProgress size={28} />}
      {!loading && !items && <Typography color="textSecondary">{t('auditHint')}</Typography>}
      {!loading && items && (
        <Paper variant="outlined" className={classes.table}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t('eventsTime')}</TableCell>
                <TableCell>{t('auditUser')}</TableCell>
                <TableCell>{t('auditAction')}</TableCell>
                <TableCell>{t('auditObject')}</TableCell>
                <TableCell>{t('auditAddress')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.slice(0, displayLimit).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell className={classes.nowrap}>
                    {dayjs(item.actionTime).format('YYYY-MM-DD HH:mm:ss')}
                  </TableCell>
                  <TableCell className={classes.nowrap}>{item.userEmail || item.userId}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={actionColors[item.actionType] || 'default'}
                      label={item.actionType}
                    />
                  </TableCell>
                  <TableCell className={classes.nowrap}>
                    {item.objectType ? `${item.objectType} #${item.objectId}` : '—'}
                  </TableCell>
                  <TableCell className={classes.nowrap}>{item.address}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <Typography className={classes.empty} color="textSecondary">
              {t('eventsNone')}
            </Typography>
          )}
        </Paper>
      )}
    </div>
  );
};

export default AuditPage;
