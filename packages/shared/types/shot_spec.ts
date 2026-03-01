export interface ShotSpec {
    shotId: string;
    characterId: string;
    framing: 'ECU' | 'CU' | 'MCU' | 'MS' | 'LS'; // Extreme Close Up, Close Up, etc.
    cameraAngle: 'low' | 'eye' | 'high' | 'dutch';
    motionIntensity: number; // 1-10
    lighting: string;
    environment: string;
    actionDescription: string;
    dialogue?: string;
    transition?: string;
    anchorAngle: 'front' | 'side' | 'back' | 'angle45';
}

export interface EpisodeShotSpecs {
    episodeId: string;
    shots: ShotSpec[];
}
