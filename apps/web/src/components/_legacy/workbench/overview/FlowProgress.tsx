'use client';

import React from 'react';
import { ProjectFlowDTO } from '@scu/shared-types';

export function FlowProgress({ flow, onAction }: { flow: ProjectFlowDTO, onAction?: (key: string, href?: string) => void }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Production Pipeline</h3>

            <div className="relative flex justify-between">
                {/* Connecting Line */}
                <div className="absolute top-4 left-8 right-8 h-1 bg-gray-100 z-0"></div>

                {flow.nodes.map((node, i) => {
                    const statusColors = {
                        PENDING: 'bg-white border-gray-300 text-gray-400',
                        RUNNING: 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200',
                        DONE: 'bg-blue-600 border-blue-600 text-white',
                        FAILED: 'bg-red-500 border-red-500 text-white',
                        BLOCKED: 'bg-gray-100 border-gray-400 text-gray-500',
                    };

                    const isRunning = node.status === 'RUNNING';

                    return (
                        <div key={node.key} className="relative z-10 flex flex-col items-center flex-1">
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${statusColors[node.status]} ${isRunning ? 'scale-110 ring-4 ring-blue-50' : ''}`}
                            >
                                {node.status === 'DONE' ? '✓' : (i + 1)}
                            </div>

                            <div className="mt-3 text-center flex flex-col items-center">
                                <div className={`text-sm font-medium ${node.status === 'PENDING' ? 'text-gray-400' : 'text-gray-700'}`}>
                                    {node.label}
                                </div>
                                {isRunning && (
                                    <div className="text-xs text-blue-600 font-medium mt-1 animate-pulse">Running...</div>
                                )}
                                {node.status === 'FAILED' && (
                                    <div className="text-xs text-red-600 font-medium mt-1">Failed</div>
                                )}

                                {/* Action Buttons */}
                                {node.actions && node.actions.map(action => (
                                    action.enabled && (
                                        <button
                                            key={action.key}
                                            onClick={() => onAction?.(action.key, action.href)}
                                            className="mt-2 text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                            title={action.disabledReason}
                                        >
                                            {action.label}
                                        </button>
                                    )
                                ))}
                            </div>

                            {/* Quick Actions Popup (Simplified for now) */}
                            {node.gate.canRun === false && !node.status && (
                                <div className="absolute top-14 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100">
                                    {(node.gate as any).blockedReason?.message || 'Locked'}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
