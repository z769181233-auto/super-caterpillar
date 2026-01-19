'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getPreviewStatus, getPreviewUrl } from '@/lib/preview-status';

interface Shot {
  id: string;
  index: number;
  type: string;
  renderStatus?: string;
  resultImageUrl?: string;
  resultVideoUrl?: string;
  visualPrompt?: string;
}

interface ShotWallProps {
  shots: Shot[];
  selectedShotId: string | null;
  onSelectShot: (id: string) => void;
}

export default function ShotWall({ shots, selectedShotId, onSelectShot }: ShotWallProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: shots.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 142, // 卡片高度 130 + 间距 12
    overscan: 5,
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 tracking-tight">
          SHOT WALL <span className="text-blue-500 ml-1 font-mono">{shots.length}</span>
        </h3>
        <div className="flex gap-2">
          <span className="text-[10px] px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-black uppercase tracking-widest border border-green-200">
            VIRTUALIZED Engine
          </span>
        </div>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto px-4 py-2"
        style={{ contentVisibility: 'auto' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const shot = shots[virtualItem.index];
            if (!shot) return null;

            const status = getPreviewStatus(shot);
            const previewUrl = getPreviewUrl(shot);
            const isSelected = selectedShotId === shot.id;

            return (
              <div
                key={virtualItem.key}
                onClick={() => onSelectShot(shot.id)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `130px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className={`
                  p-3 rounded-2xl border-2 cursor-pointer transition-all flex gap-4
                  ${isSelected ? 'border-blue-600 bg-white shadow-2xl scale-[1.01] z-10' : 'border-transparent bg-white hover:border-gray-200 shadow-sm'}
                `}
              >
                {/* Preview Proxy Area */}
                <div
                  className={`
                  w-48 h-full rounded-xl flex items-center justify-center overflow-hidden relative border border-gray-100 bg-gray-50
                  ${status === 'PENDING' ? 'ring-2 ring-blue-400 ring-inset' : ''}
                `}
                >
                  {status === 'READY' && previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2 flex flex-col items-center">
                      {status === 'PENDING' ? (
                        <>
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                          <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest">
                            Rendering
                          </span>
                        </>
                      ) : (
                        <div className="flex flex-col items-center opacity-30">
                          <span className="text-[12px] text-gray-400 font-black uppercase italic">
                            {status}
                          </span>
                          <span className="text-[9px] text-gray-400">NO MEDIA</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between py-1.5">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-black ${isSelected ? 'text-blue-600' : 'text-gray-900'} font-mono`}
                        >
                          #{shot.index.toString().padStart(3, '0')}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-[10px] uppercase font-bold text-gray-500 border border-gray-200">
                          {shot.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${status === 'READY' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                      >
                        V3.0 CORE
                      </div>
                    </div>
                    <p
                      className={`text-[13px] leading-tight line-clamp-3 ${isSelected ? 'text-gray-800' : 'text-gray-500'}`}
                    >
                      {shot.visualPrompt || 'No visual description provided for this shot.'}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className="flex gap-2 items-center bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          status === 'READY'
                            ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                            : status === 'PENDING'
                              ? 'bg-blue-500 animate-pulse'
                              : status === 'FAILED'
                                ? 'bg-red-500'
                                : 'bg-gray-300'
                        }`}
                      />
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                        {status}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <button className="text-[10px] text-gray-400 font-bold hover:text-black transition-colors uppercase">
                        DEBUG
                      </button>
                      <button className="text-[10px] text-blue-600 font-black hover:underline uppercase">
                        REGENERATE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
