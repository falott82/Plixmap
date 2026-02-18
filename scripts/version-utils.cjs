const README_VERSION_REGEX = /Current version:\s*([0-9]+\.[0-9]+\.[0-9]+)/i;
const HISTORY_VERSION_REGEX = /version:\s*'([0-9]+\.[0-9]+\.[0-9]+)'/;

const extractReadmeVersion = (readmeText) => {
  const match = README_VERSION_REGEX.exec(String(readmeText || ''));
  return match ? String(match[1]) : null;
};

const extractHistoryVersion = (historyText) => {
  const match = HISTORY_VERSION_REGEX.exec(String(historyText || ''));
  return match ? String(match[1]) : null;
};

const validateVersionConsistency = ({ packageVersion, readmeVersion, historyVersion }) => {
  const errors = [];
  if (!packageVersion) errors.push('Missing package.json version');
  if (!readmeVersion) errors.push('Unable to parse README version');
  if (!historyVersion) errors.push('Unable to parse src/version/history.ts latest version');
  if (packageVersion && readmeVersion && packageVersion !== readmeVersion) {
    errors.push(`Version mismatch: package.json=${packageVersion}, README=${readmeVersion}`);
  }
  if (packageVersion && historyVersion && packageVersion !== historyVersion) {
    errors.push(`Version mismatch: package.json=${packageVersion}, history=${historyVersion}`);
  }
  return errors;
};

module.exports = {
  extractHistoryVersion,
  extractReadmeVersion,
  validateVersionConsistency
};
