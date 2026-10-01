import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import {
  Autocomplete,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { sessionActions } from '../../../store';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import exportExcel from '../../../common/util/exportExcel';
import { useCatch } from '../../../reactHelper';
import ConfirmDialog from '../../common/ConfirmDialog';
import { useUnits } from '../../common/format';
import useT from '../../common/useT';
import reportTypes, { periodRange, periods, reportTypeMap } from './reportTypes';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'start',
    [theme.breakpoints.up('lg')]: {
      gridTemplateColumns: '340px minmax(0, 1fr)',
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  buttons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  grow: {
    flexGrow: 1,
  },
  table: {
    overflowX: 'auto',
    maxHeight: '70vh',
  },
  cell: {
    whiteSpace: 'nowrap',
  },
  hint: {
    padding: theme.spacing(2),
  },
}));

const presetsKey = 'v2ReportPresets';
const displayLimit = 1000;

const periodTitleKeys = {
  today: 'periodToday',
  yesterday: 'periodYesterday',
  thisWeek: 'periodThisWeek',
  lastWeek: 'periodLastWeek',
  thisMonth: 'periodThisMonth',
  lastMonth: 'periodLastMonth',
  custom: 'periodCustom',
};

const parsePresets = (user) => {
  try {
    return JSON.parse(user.attributes[presetsKey] || '[]');
  } catch {
    return [];
  }
};

const inputFormat = 'YYYY-MM-DDTHH:mm';

const emptyConfig = () => ({
  type: 'trips',
  deviceIds: [],
  period: 'today',
  from: dayjs().startOf('day').format(inputFormat),
  to: dayjs().format(inputFormat),
});

// Report builder for company Admins. Saved "report methods" (type, vehicles and period) are
// stored in the Admin's own user attributes, so they follow the account between browsers.
const ReportsPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { speedUnit, distanceUnit } = useUnits();

  const user = useSelector((state) => state.session.user);
  const items = useSelector((state) => state.devices.items);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );
  const presets = useMemo(() => parsePresets(user), [user]);

  const [config, setConfig] = useState(emptyConfig);
  const [presetName, setPresetName] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [removing, setRemoving] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const type = reportTypeMap[config.type];
  const ctx = { t, speedUnit, distanceUnit, devices: items };

  const loadPreset = (preset) => {
    setPresetName(preset?.name ?? null);
    if (preset) {
      setConfig({ ...emptyConfig(), ...preset.config });
      setResult(null);
    }
  };

  const savePresets = async (next) => {
    const response = await fetchOrThrow(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...user,
        attributes: { ...user.attributes, [presetsKey]: JSON.stringify(next) },
      }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
  };

  const handleSave = useCatch(async () => {
    const name = saveName.trim();
    await savePresets([...presets.filter((preset) => preset.name !== name), { name, config }]);
    setPresetName(name);
    setSaveOpen(false);
  });

  const handleRemove = useCatch(async () => {
    await savePresets(presets.filter((preset) => preset.name !== presetName));
    setPresetName(null);
    setRemoving(false);
  });

  const generate = useCatch(async () => {
    const [from, to] = periodRange(config.period, config.from, config.to);
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    Object.entries(type.query || {}).forEach(([key, value]) => query.append(key, value));
    const deviceIds = config.deviceIds.length ? config.deviceIds : devices.map((d) => d.id);
    deviceIds.forEach((id) => query.append('deviceId', id));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/reports/${type.key}?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setResult({ type: type.key, from, to, rows: await response.json() });
    } finally {
      setLoading(false);
    }
  });

  const resultType = result && reportTypeMap[result.type];

  const handleExport = useCatch(async () => {
    const rows = result.rows.map((row) =>
      Object.fromEntries(
        resultType.columns.map((column) => [t(column.titleKey), column.format(row, ctx)]),
      ),
    );
    const title = `${t(resultType.titleKey)} ${result.from.format('YYYY-MM-DD')} – ${result.to.format('YYYY-MM-DD')}`;
    await exportExcel(
      title,
      `${resultType.key}.xlsx`,
      new Map([[t(resultType.titleKey), rows]]),
      theme,
    );
  });

  const selectedDevices = devices.filter((device) => config.deviceIds.includes(device.id));

  return (
    <div className={classes.root}>
      <Card variant="outlined">
        <CardContent className={classes.form}>
          <Autocomplete
            options={presets}
            value={presets.find((preset) => preset.name === presetName) || null}
            onChange={(_, value) => loadPreset(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.name === value.name}
            renderInput={(params) => <TextField {...params} label={t('reportsPreset')} />}
            noOptionsText={t('reportsPresetNone')}
          />
          <TextField
            select
            label={t('reportsType')}
            value={config.type}
            onChange={(e) => setConfig({ ...config, type: e.target.value })}
          >
            {reportTypes.map((reportType) => (
              <MenuItem key={reportType.key} value={reportType.key}>
                {t(reportType.titleKey)}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            multiple
            options={devices}
            value={selectedDevices}
            onChange={(_, value) => setConfig({ ...config, deviceIds: value.map((d) => d.id) })}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => {
                const { key, ...props } = getItemProps({ index });
                return <Chip key={key} size="small" label={option.name} {...props} />;
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('reportsVehicles')}
                placeholder={config.deviceIds.length ? '' : t('reportsAllVehicles')}
              />
            )}
          />
          <TextField
            select
            label={t('reportsPeriod')}
            value={config.period}
            onChange={(e) => setConfig({ ...config, period: e.target.value })}
          >
            {periods.map((period) => (
              <MenuItem key={period} value={period}>
                {t(periodTitleKeys[period])}
              </MenuItem>
            ))}
          </TextField>
          {config.period === 'custom' && (
            <>
              <TextField
                type="datetime-local"
                label={t('reportsFrom')}
                value={config.from}
                onChange={(e) => setConfig({ ...config, from: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                type="datetime-local"
                label={t('reportsTo')}
                value={config.to}
                onChange={(e) => setConfig({ ...config, to: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </>
          )}
          <div className={classes.buttons}>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={loading || devices.length === 0}
              onClick={generate}
            >
              {t('reportsGenerate')}
            </Button>
            <Button
              startIcon={<SaveIcon />}
              onClick={() => {
                setSaveName(presetName || '');
                setSaveOpen(true);
              }}
            >
              {t('reportsSavePreset')}
            </Button>
            {presetName && (
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => setRemoving(true)}>
                {t('remove')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className={classes.results}>
        {loading && <CircularProgress size={28} />}
        {!loading && !result && (
          <Typography className={classes.hint} color="textSecondary">
            {t('reportsHint')}
          </Typography>
        )}
        {!loading && result && (
          <>
            <div className={classes.resultsHeader}>
              <Typography variant="subtitle1" fontWeight={600} className={classes.grow}>
                {`${t(resultType.titleKey)} · ${result.from.format('YYYY-MM-DD HH:mm')} – ${result.to.format('YYYY-MM-DD HH:mm')} · ${result.rows.length} ${t('reportsRows')}`}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                disabled={result.rows.length === 0}
                onClick={handleExport}
              >
                Excel
              </Button>
            </div>
            <Paper variant="outlined" className={classes.table}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {resultType.columns.map((column) => (
                      <TableCell key={column.key} className={classes.cell}>
                        {t(column.titleKey)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.rows.slice(0, displayLimit).map((row, index) => (
                    <TableRow key={row.id ?? index} hover>
                      {resultType.columns.map((column) => (
                        <TableCell key={column.key} className={classes.cell}>
                          {column.format(row, ctx)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {result.rows.length === 0 && (
                <Typography className={classes.hint} color="textSecondary">
                  {t('reportsEmpty')}
                </Typography>
              )}
            </Paper>
            {result.rows.length > displayLimit && (
              <Typography variant="caption" color="textSecondary">
                {t('reportsTruncated')}
              </Typography>
            )}
          </>
        )}
      </div>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('reportsSavePreset')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            sx={{ mt: 1 }}
            label={t('reportsPresetName')}
            helperText={t('reportsPresetNameHint')}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveOpen(false)}>{t('cancel')}</Button>
          <Button variant="contained" disabled={!saveName.trim()} onClick={handleSave}>
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={removing}
        title={t('reportsRemovePreset')}
        confirmLabel={t('remove')}
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(false)}
      >
        <Typography>{presetName}</Typography>
      </ConfirmDialog>
    </div>
  );
};

export default ReportsPage;
