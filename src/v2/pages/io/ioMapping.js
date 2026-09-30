import fetchOrThrow from '../../../common/util/fetchOrThrow';

// IO mappings are Traccar computed attributes. A mapping is assigned to a company by linking
// it to the company Admin (that link records the assignment) and to every company device
// (that link makes Traccar apply it). New company devices get the company mappings through
// linkDeviceToCompany.

export const modes = ['input', 'scale', 'expression'];

export const rawKeys = [
  'in1',
  'in2',
  'in3',
  'in4',
  'out1',
  'out2',
  'out3',
  'out4',
  'adc1',
  'adc2',
  'adc3',
  'adc4',
  'power',
  'battery',
];

const inputPattern = /^(!?)([A-Za-z_]\w*)$/;
const scalePattern = /^([A-Za-z_]\w*) \* (-?[\d.]+) \+ (-?[\d.]+)$/;

export const parseExpression = (expression = '') => {
  const input = expression.match(inputPattern);
  if (input) {
    return { mode: 'input', source: input[2], invert: input[1] === '!' };
  }
  const scale = expression.match(scalePattern);
  if (scale) {
    return {
      mode: 'scale',
      source: scale[1],
      factor: Number(scale[2]),
      offset: Number(scale[3]),
    };
  }
  return { mode: 'expression', expression };
};

export const buildExpression = ({ mode, source, invert, factor, offset, expression }) => {
  switch (mode) {
    case 'input':
      return `${invert ? '!' : ''}${source}`;
    case 'scale':
      return `${source} * ${Number(factor) || 0} + ${Number(offset) || 0}`;
    default:
      return expression;
  }
};

const permission = (method, body) =>
  fetch('/api/permissions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const companyDevices = async (companyId) =>
  (await fetchOrThrow(`/api/devices?userId=${companyId}&excludeAttributes=true`)).json();

export const assignToCompany = async (attributeId, companyId) => {
  const devices = await companyDevices(companyId);
  await Promise.all([
    permission('POST', { userId: companyId, attributeId }),
    ...devices.map((device) => permission('POST', { deviceId: device.id, attributeId })),
  ]);
};

export const unassignFromCompany = async (attributeId, companyId) => {
  const devices = await companyDevices(companyId);
  await Promise.all([
    permission('DELETE', { userId: companyId, attributeId }),
    ...devices.map((device) => permission('DELETE', { deviceId: device.id, attributeId })),
  ]);
};
