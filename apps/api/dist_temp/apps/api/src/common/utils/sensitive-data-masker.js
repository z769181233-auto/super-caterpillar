"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskSensitiveValue = maskSensitiveValue;
exports.maskSensitiveData = maskSensitiveData;
exports.maskSensitiveString = maskSensitiveString;
const SENSITIVE_KEYS = [
    'password',
    'secret',
    'key',
    'token',
    'authorization',
    'signature',
    'dbUrl',
    'databaseUrl',
    'jwt',
    'cookie',
];
function maskSensitiveValue(value) {
    if (typeof value !== 'string')
        return value;
    if (value.length <= 8)
        return '********';
    return `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
}
function maskSensitiveData(data) {
    if (data === null || data === undefined)
        return data;
    if (Array.isArray(data)) {
        return data.map((item) => maskSensitiveData(item));
    }
    if (typeof data === 'object') {
        const maskedObj = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const lowerKey = key.toLowerCase();
                const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
                if (isSensitive) {
                    maskedObj[key] = maskSensitiveValue(data[key]);
                }
                else {
                    maskedObj[key] = maskSensitiveData(data[key]);
                }
            }
        }
        return maskedObj;
    }
    return data;
}
function maskSensitiveString(str) {
    if (!str)
        return str;
    let masked = str;
    masked = masked.replace(/(postgres:\/\/)([^:]+):([^@]+)@/g, '$1$2:****@');
    SENSITIVE_KEYS.forEach((key) => {
        const regex = new RegExp(`(${key}\\s*[:=]\\s*["']?)([^"']{4})([^"']*)([^"']{4})(["']?)`, 'gi');
        masked = masked.replace(regex, '$1$2****$4$5');
    });
    return masked;
}
//# sourceMappingURL=sensitive-data-masker.js.map