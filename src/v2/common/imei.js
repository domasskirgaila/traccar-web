// IMEI: 15 digits, the last one a Luhn check digit.
export const isValidImei = (value) => {
  if (!/^\d{15}$/.test(value)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let digit = Number(value[14 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

// Finds IMEI numbers in scanned or recognised text. Labels print them with spaces or dashes
// ("35 209900 176148 1") and QR codes often wrap them ("IMEI:352099001761481;SN:..."), so
// digit groups are joined before checking. Valid IMEIs come first; other 15 digit numbers
// are kept as a fallback because some test devices use made-up numbers.
export const extractImeis = (texts) => {
  const found = new Map();
  texts.forEach((text) => {
    const runs = text.match(/\d[\d\s-]{13,24}\d/g) || [];
    runs.forEach((run) => {
      const digits = run.replace(/\D/g, '');
      for (let start = 0; start + 15 <= digits.length; start += 1) {
        const candidate = digits.slice(start, start + 15);
        if (isValidImei(candidate) || digits.length === 15) {
          found.set(candidate, isValidImei(candidate));
        }
      }
    });
  });
  return [...found.entries()]
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([imei, valid]) => ({ imei, valid }));
};
