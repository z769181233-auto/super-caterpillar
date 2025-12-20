/**
 * 敏感数据脱敏工具
 * 实现对日志中可能包含的密钥、密码、令牌等敏感信息的正则屏蔽
 */

// 敏感字段白名单（需要脱敏的键名）
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

// 正则掩码：对于包含上述关键词的字段值，仅保留前 4 位和后 4 位，中间使用通配符掩码
export function maskSensitiveValue(value: any): any {
    if (typeof value !== 'string') return value;
    if (value.length <= 8) return '********';
    return `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
}

/**
 * 递归深度脱敏对象
 */
export function maskSensitiveData(data: any): any {
    if (data === null || data === undefined) return data;

    if (Array.isArray(data)) {
        return data.map((item) => maskSensitiveData(item));
    }

    if (typeof data === 'object') {
        const maskedObj: any = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const lowerKey = key.toLowerCase();
                const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));

                if (isSensitive) {
                    maskedObj[key] = maskSensitiveValue(data[key]);
                } else {
                    maskedObj[key] = maskSensitiveData(data[key]);
                }
            }
        }
        return maskedObj;
    }

    return data;
}

/**
 * 字符串内容脱敏（用于处理全量 Dump 或错误消息）
 */
export function maskSensitiveString(str: string): string {
    if (!str) return str;
    let masked = str;

    // 正则：匹配常用的 Secret 格式 (如 postgres://... , ak_... , sk_...)
    // 匹配 postgres://user:password@host
    masked = masked.replace(/(postgres:\/\/)([^:]+):([^@]+)@/g, '$1$2:****@');

    // 匹配类似 key=val 的结构中的敏感词
    SENSITIVE_KEYS.forEach((key) => {
        const regex = new RegExp(`(${key}\\s*[:=]\\s*["']?)([^"']{4})([^"']*)([^"']{4})(["']?)`, 'gi');
        masked = masked.replace(regex, '$1$2****$4$5');
    });

    return masked;
}
