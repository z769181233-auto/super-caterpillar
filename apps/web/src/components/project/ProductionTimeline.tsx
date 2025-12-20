import React from 'react';

interface ProductionTimelineProps {
    statusSummary: {
        analysis: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';
        render: string;
    };
    productionStatus: 'IDLE' | 'READY' | 'RUNNING' | 'DONE';
}

const STEPS = [
    { id: 'import', label: '1. 小说导入', stepIndex: 0 },
    { id: 'analysis', label: '2. 结构分析', stepIndex: 1 },
    { id: 'scene', label: '3. 场景生成', stepIndex: 2 },
    { id: 'video', label: '4. 视频生成', stepIndex: 3 },
    { id: 'quality', label: '5. 质量校验', stepIndex: 4, disabled: true },
    { id: 'publish', label: '6. 发布', stepIndex: 5, disabled: true },
];

export const ProductionTimeline: React.FC<ProductionTimelineProps> = ({ statusSummary, productionStatus }) => {

    // Calculate current completion stage based on props
    // We need external logic to determine exactly where we are, but here's a best effort mapping:

    let completedStepIndex = -1;
    let runningStepIndex = -1;

    // Step 1: Import
    // If we are seeing this component, Project exists. 
    // If analysis is PENDING or beyond, Import is effectively done.
    // We assume Import is ALWAYS done for an active project (even if empty, it's "Imported" state awaiting analysis)
    completedStepIndex = 0;

    // Step 2: Analysis
    if (statusSummary.analysis === 'ANALYZING') {
        runningStepIndex = 1;
    } else if (statusSummary.analysis === 'DONE') {
        completedStepIndex = 1;
    }

    // Step 3: Scene Gen
    // Usually simultaneous with Analysis Done in current backend
    if (completedStepIndex >= 1) {
        completedStepIndex = 2; // Auto-complete Scene Gen if Analysis Done
    }

    // Step 4: Video Gen
    // productionStatus mappings from ProjectStructureService:
    // RUNNING -> "ANALYZING" (Analysis phase)
    // DONE -> Analysis Done.
    // READY -> Structure Ready.
    // This prop 'productionStatus' is a bit ambiguous in current backend.
    // We will rely on parent passing valid 'render' status or inferred status.

    if (statusSummary.render === 'RUNNING') {
        runningStepIndex = 3;
    } else if (statusSummary.render === 'DONE' || statusSummary.render === 'PARTIAL') {
        completedStepIndex = 3;
    }

    // Visual Logic:
    // If runningStepIndex is set, that step is pulsed/active.
    // All steps <= completedStepIndex are checked.

    return (
        <div className="w-full max-w-5xl mx-auto py-12 px-4">
            <div className="relative flex justify-between items-center">
                {/* Track Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 -z-10 transform -translate-y-1/2" />

                {STEPS.map((step, index) => {
                    const isCompleted = index <= completedStepIndex;
                    const isRunning = index === runningStepIndex;
                    const isDisabled = step.disabled;

                    let stateClass = "bg-gray-900 border-gray-600 text-gray-500"; // Default/Pending
                    if (isCompleted) stateClass = "bg-green-600 border-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]";
                    if (isRunning) stateClass = "bg-blue-600 border-blue-600 text-white animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.5)]";
                    if (isDisabled) stateClass = "bg-gray-900 border-gray-800 text-gray-700 opacity-50";

                    return (
                        <div key={step.id} className="flex flex-col items-center gap-4 relative group">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 z-10 ${stateClass}`}
                            >
                                {isCompleted ? '✓' : index + 1}
                            </div>
                            <span className={`text-sm font-medium whitespace-nowrap absolute -bottom-8 ${isCompleted || isRunning ? 'text-white' : 'text-gray-500'} ${isDisabled ? 'text-gray-700' : ''}`}>
                                {step.label}
                            </span>

                            {/* Tooltip/Status Text for Running */}
                            {isRunning && (
                                <div className="absolute -top-10 bg-blue-600 text-xs px-2 py-1 rounded text-white whitespace-nowrap animate-bounce">
                                    处理中...
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-16 text-center border-t border-gray-800 pt-8">
                <h2 className="text-xl font-bold text-white mb-2">
                    {runningStepIndex !== -1 ? STEPS[runningStepIndex].label + ' 进行中' :
                        completedStepIndex >= 3 ? '生产阶段已完成' :
                            STEPS[completedStepIndex + 1]?.label + ' 待开始'}
                </h2>
                <p className="text-gray-400">
                    {runningStepIndex === 1 && '正在深入分析小说剧情、提取角色与构建分镜...'}
                    {runningStepIndex === 3 && '正在渲染生成视频画面，请稍候...'}
                    {completedStepIndex === 3 && '视频已生成，您可以进行预览或发布。'}
                </p>
            </div>
        </div>
    );
};
