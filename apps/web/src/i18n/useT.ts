// apps/web/src/i18n/useT.ts
import { dict, Locale } from "./dict";

export function createT(locale: Locale) {
    const table = dict[locale] ?? dict.zh;

    return function t<K extends keyof typeof table>(key: K, vars?: Record<string, string | number>) {
        let s = (table[key] || key) as string;
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                s = s.replaceAll(`{${k}}`, String(v));
            }
        }
        return s;
    };
}
