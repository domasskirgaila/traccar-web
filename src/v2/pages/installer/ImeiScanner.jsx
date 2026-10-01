import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { Scanner, setZXingModuleOverrides } from '@yudiel/react-qr-scanner';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { extractImeis } from '../../common/imei';
import useT from '../../common/useT';

// The barcode engine is served from this app instead of the default CDN, so scanning works
// on sites without internet access to jsDelivr.
setZXingModuleOverrides({
  locateFile: (path, prefix) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path),
});

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  scanner: {
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    aspectRatio: '1',
    maxHeight: '50vh',
    width: '100%',
  },
  candidates: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  fileInput: {
    display: 'none',
  },
}));

// IMEI labels carry Code 128 barcodes, QR codes or only printed digits.
const formats = ['code_128', 'code_39', 'qr_code', 'data_matrix', 'ean_13', 'itf'];

const decodeBarcodes = async (file) => {
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  const detector = new BarcodeDetector({ formats });
  const bitmap = await createImageBitmap(file);
  try {
    return (await detector.detect(bitmap)).map((code) => code.rawValue);
  } finally {
    bitmap.close();
  }
};

// Text recognition is only loaded when a photo has no readable barcode.
const recognizeText = async (file, onProgress) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        onProgress(message.progress);
      }
    },
  });
  try {
    await worker.setParameters({ tessedit_char_whitelist: '0123456789 -:IMEImei' });
    const { data } = await worker.recognize(file);
    return [data.text];
  } finally {
    await worker.terminate();
  }
};

// Scans an IMEI with the phone camera: live barcode/QR scanning (needs HTTPS) or a photo of the
// label, which is decoded as a barcode first and read as text when that fails.
const ImeiScanner = ({ open, onClose, onDetected }) => {
  const { classes } = useStyles();
  const t = useT();
  const fileInputRef = useRef(null);

  const [candidates, setCandidates] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);

  const liveAvailable = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

  const reset = () => {
    setCandidates(null);
    setStatus(null);
    setProgress(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const accept = (imei) => {
    reset();
    onDetected(imei);
  };

  const handleResults = (texts) => {
    const found = extractImeis(texts);
    if (found.length === 1 && found[0].valid) {
      accept(found[0].imei);
    } else {
      setCandidates(found);
      setStatus(null);
      setProgress(null);
    }
  };

  const handlePhoto = async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) {
      return;
    }
    setCandidates(null);
    try {
      setStatus(t('scanReadingBarcode'));
      const codes = await decodeBarcodes(file);
      if (extractImeis(codes).length) {
        handleResults(codes);
        return;
      }
      setStatus(t('scanReadingText'));
      setProgress(0);
      handleResults(await recognizeText(file, setProgress));
    } catch (error) {
      setStatus(null);
      setProgress(null);
      setCandidates([]);
      console.warn(error);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>{t('scanTitle')}</DialogTitle>
      <DialogContent className={classes.content}>
        {liveAvailable ? (
          <div className={classes.scanner}>
            <Scanner
              formats={formats}
              paused={!open || Boolean(status)}
              onScan={(codes) => handleResults(codes.map((code) => code.rawValue))}
              constraints={{ facingMode: 'environment' }}
              sound={false}
            />
          </div>
        ) : (
          <Alert severity="info">{t('scanLiveUnavailable')}</Alert>
        )}
        <Button
          variant={liveAvailable ? 'outlined' : 'contained'}
          startIcon={<PhotoCameraIcon />}
          disabled={Boolean(status)}
          onClick={() => fileInputRef.current.click()}
        >
          {t('scanPhoto')}
        </Button>
        <input
          ref={fileInputRef}
          className={classes.fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
        />
        {status && (
          <div>
            <Typography variant="body2">{status}</Typography>
            <LinearProgress
              variant={progress === null ? 'indeterminate' : 'determinate'}
              value={(progress || 0) * 100}
            />
          </div>
        )}
        {candidates && candidates.length === 0 && (
          <Alert severity="warning">{t('scanNothingFound')}</Alert>
        )}
        {candidates && candidates.length > 0 && (
          <>
            <Typography variant="body2">{t('scanChoose')}</Typography>
            <div className={classes.candidates}>
              {candidates.map(({ imei, valid }) => (
                <Chip
                  key={imei}
                  label={imei}
                  color={valid ? 'primary' : 'default'}
                  variant={valid ? 'filled' : 'outlined'}
                  onClick={() => accept(imei)}
                />
              ))}
            </div>
            {candidates.some((candidate) => !candidate.valid) && (
              <Typography variant="caption" color="textSecondary">
                {t('scanInvalidHint')}
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{t('cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImeiScanner;
