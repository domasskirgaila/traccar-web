import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import useT from './useT';

const ConfirmDialog = ({ open, title, children, confirmLabel, danger, onConfirm, onCancel }) => {
  const t = useT();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('cancel')}</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
