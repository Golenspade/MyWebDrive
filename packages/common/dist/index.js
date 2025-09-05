export function ok(data) {
    return { ok: true, data };
}
export function err(code, message, details) {
    return { ok: false, error: { code, message, details } };
}
export function getEnv(key, fallback) {
    const v = process.env[key];
    if (v === undefined || v === '') {
        if (fallback !== undefined)
            return fallback;
        throw new Error(`Missing required env: ${key}`);
    }
    return v;
}
export function requireEnvs(keys) {
    const missing = keys.filter((k) => !process.env[k] || process.env[k] === '');
    if (missing.length) {
        throw new Error(`Missing required envs: ${missing.join(', ')}`);
    }
}
//# sourceMappingURL=index.js.map