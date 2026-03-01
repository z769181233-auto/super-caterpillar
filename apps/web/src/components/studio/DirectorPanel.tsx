'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const shotSchema = z.object({
  visualPrompt: z.string().min(1, 'Prompt is required'),
  type: z.string(),
  cameraMovement: z.string().optional(),
});

type ShotFormValues = z.infer<typeof shotSchema>;

interface Shot {
  id: string;
  index: number;
  type: string;
  visualPrompt?: string;
  cameraMovement?: string;
  assetBindings?: any;
}

interface DirectorPanelProps {
  shot: Shot | null;
  onSave: (id: string, updates: Partial<Shot>) => Promise<void>;
}

export default function DirectorPanel({ shot, onSave }: DirectorPanelProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<ShotFormValues>({
    resolver: zodResolver(shotSchema),
    defaultValues: {
      visualPrompt: '',
      type: 'MEDIUM_SHOT',
      cameraMovement: '',
    },
  });

  useEffect(() => {
    if (shot) {
      reset({
        visualPrompt: shot.visualPrompt || '',
        type: shot.type || 'MEDIUM_SHOT',
        cameraMovement: shot.cameraMovement || '',
      });
    }
  }, [shot, reset]);

  if (!shot) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50">
        <div className="w-12 h-12 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center mb-4">
          <span className="text-xl">⊕</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest">Select a shot</p>
        <p className="text-[10px] mt-1 opacity-60 italic">to activate director controls</p>
      </div>
    );
  }

  const onSubmit = async (data: ShotFormValues) => {
    await onSave(shot.id, data);
    reset(data); // 提交后重置 dirty 状态
  };

  return (
    <div className="h-full flex flex-col bg-white border-l transition-all duration-300">
      <div className="p-4 border-b bg-gray-900 flex justify-between items-center text-white">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">
            Director Control
          </h3>
          <p className="text-xs font-mono font-bold">SHOT_UUID: {shot.id.slice(0, 8)}...</p>
        </div>
        <div className="bg-blue-600 px-2 py-1 rounded font-mono text-[10px] font-black">
          #{shot.index.toString().padStart(3, '0')}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-6 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
              Visual Prompt
            </span>
            {errors.visualPrompt && (
              <span className="text-[9px] text-red-500 font-bold uppercase">
                {errors.visualPrompt.message}
              </span>
            )}
          </label>
          <textarea
            {...register('visualPrompt')}
            className={`
              w-full p-3 text-sm border-2 rounded-xl min-h-[160px] focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none leading-relaxed
              ${errors.visualPrompt ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200'}
            `}
            placeholder="Describe the scene in detail for the AI generator..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block text-nowrap">
              Shot Type
            </label>
            <select
              {...register('type')}
              className="w-full p-2.5 text-xs border-2 border-gray-100 bg-gray-50/50 rounded-lg focus:ring-4 focus:ring-blue-100 outline-none hover:bg-white transition-all font-bold"
            >
              <option value="EXTREME_CLOSE_UP">Extreme Close Up</option>
              <option value="CLOSE_UP">Close Up</option>
              <option value="MEDIUM_SHOT">Medium Shot</option>
              <option value="WIDE_SHOT">Wide Shot</option>
              <option value="EXTREME_WIDE_SHOT">Extreme Wide Shot</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block">
              Movement
            </label>
            <input
              type="text"
              {...register('cameraMovement')}
              className="w-full p-2.5 text-xs border-2 border-gray-100 bg-gray-50/50 rounded-lg focus:ring-4 focus:ring-blue-100 outline-none hover:bg-white transition-all"
              placeholder="e.g. Dolly In"
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
              Advanced Bindings
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-gray-400">
              <span>CHARACTER_REF</span>
              <span className="text-green-600 font-bold">LINKED</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-gray-400">
              <span>SEC_CONTROLNET</span>
              <span className="text-gray-300 italic">EMPTY</span>
            </div>
          </div>
        </div>
      </form>

      <div className="p-4 border-t bg-white sticky bottom-0">
        <button
          type="submit"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || !isDirty}
          className={`
            w-full py-3 rounded-xl font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2
            ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : !isDirty
                  ? 'bg-gray-100 text-gray-400 cursor-default'
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-200 active:scale-95'
            }
          `}
        >
          {isSubmitting ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              SYNCING...
            </>
          ) : (
            'COMMIT CHANGES'
          )}
        </button>
      </div>
    </div>
  );
}
