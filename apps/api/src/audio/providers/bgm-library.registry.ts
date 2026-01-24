
export const BGM_LIBRARY_V1 = [
    { id: 'bgm_001_cine', baseFreq: 110, pulseFreq: 2, weight: 1 },
    { id: 'bgm_002_lofi', baseFreq: 220, pulseFreq: 4, weight: 1 },
    { id: 'bgm_003_fast', baseFreq: 330, pulseFreq: 6, weight: 1 },
];

export const BGM_LIBRARY_V2_COM = [
    { id: 'bgm_201_pop', baseFreq: 440, pulseFreq: 8, weight: 1 },
    { id: 'bgm_202_techno', baseFreq: 550, pulseFreq: 10, weight: 1 },
];

export const BGM_LIBRARIES: Record<string, { version: string, tracks: any[] }> = {
    'bgm_lib_v1': { version: 'v1.0.0', tracks: BGM_LIBRARY_V1 },
    'bgm_lib_v2_com': { version: 'v2.0.0-exp', tracks: BGM_LIBRARY_V2_COM },
};

export const DEFAULT_BGM_LIBRARY_ID = 'bgm_lib_v1';
