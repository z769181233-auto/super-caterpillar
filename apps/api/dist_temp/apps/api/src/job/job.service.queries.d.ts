export declare const SHOT_JOB_WITH_HIERARCHY: {
    task: true;
    shot: {
        include: {
            scene: {
                include: {
                    episode: {
                        include: {
                            season: {
                                include: {
                                    project: true;
                                };
                            };
                        };
                    };
                };
            };
        };
    };
};
export declare const SHOT_WITH_HIERARCHY: {
    scene: {
        include: {
            episode: {
                include: {
                    project: true;
                    season: {
                        include: {
                            project: true;
                        };
                    };
                };
            };
        };
    };
};
