import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useAsyncTask } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import StatusDot from '../../common/StatusDot';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  list: {
    maxHeight: 360,
    overflow: 'auto',
    marginTop: theme.spacing(1),
  },
  item: {
    gap: theme.spacing(1.5),
  },
  search: {
    marginTop: theme.spacing(1.5),
  },
}));

// The company's equipment, newest first, to re-test an existing installation.
const CompanyDevices = ({ company, reloadKey, selectedId, onSelect }) => {
  const { classes } = useStyles();
  const t = useT();

  const [devices, setDevices] = useState(null);
  const [keyword, setKeyword] = useState('');

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      setDevices(null);
      const response = await fetchOrThrow(
        `/api/devices?userId=${company.id}&excludeAttributes=true`,
        { signal },
      );
      setDevices((await response.json()).sort((a, b) => b.id - a.id));
    },
    [company.id, reloadKey],
  );

  const filtered = useMemo(() => {
    const lowerCaseKeyword = keyword.trim().toLowerCase();
    return (devices || []).filter(
      (device) =>
        !lowerCaseKeyword ||
        [device.name, device.uniqueId].some((value) =>
          value?.toLowerCase().includes(lowerCaseKeyword),
        ),
    );
  }, [devices, keyword]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600}>
          {`${t('installerCompanyDevices')}${devices ? ` (${devices.length})` : ''}`}
        </Typography>
        <TextField
          fullWidth
          className={classes.search}
          placeholder={t('vehiclesSearch')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        {devices === null ? (
          <CircularProgress size={24} sx={{ mt: 2 }} />
        ) : (
          <List dense className={classes.list}>
            {filtered.map((device) => (
              <ListItemButton
                key={device.id}
                className={classes.item}
                selected={device.id === selectedId}
                onClick={() => onSelect(device.id)}
              >
                <StatusDot device={device} />
                <ListItemText primary={device.name} secondary={device.uniqueId} />
              </ListItemButton>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyDevices;
