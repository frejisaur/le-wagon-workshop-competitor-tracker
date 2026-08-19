export function parseDotEnv(source) {
  const parsed = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

const REFRESH_ENV_NAMES = ['APIFY_TOKEN', 'AIRTABLE_PAT', 'AIRTABLE_BASE_ID'];

export function getRefreshEnv(environment = process.env) {
  const missing = REFRESH_ENV_NAMES.filter((name) => !environment[name]);
  return {
    missing,
    present: REFRESH_ENV_NAMES.filter((name) => !missing.includes(name)),
    values: missing.length ? null : Object.fromEntries(REFRESH_ENV_NAMES.map((name) => [name, environment[name]])),
  };
}
