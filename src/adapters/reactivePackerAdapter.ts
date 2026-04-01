/**
 * Reactive Packer Adapter.
 */

import { ReactiveCompaction, type ContextSignal } from '../context/ReactiveCompaction.js';

export function withReactiveCompaction(
  packFn: (files: any[], budget: number, depth: string) => string,
  config?: { pressureThreshold?: number; emergencyThreshold?: number },
) {
  const compactor = new ReactiveCompaction({
    pressureThreshold: config?.pressureThreshold ?? 0.8,
    emergencyThreshold: config?.emergencyThreshold ?? 0.95,
    depthOrder: ['full', 'detail', 'summary', 'headlines', 'mention'],
  });
  return function reactivePack(
    files: any[],
    budget: number,
    depth: string,
    signals?: ContextSignal[],
  ): string {
    let result = packFn(files, budget, depth);
    if (signals?.length) {
      const adjustments = compactor.processSignals(signals, files);
      if (adjustments.length > 0) {
        for (const adj of adjustments) {
          const file = files.find((f: any) => f.id === adj.fileId || f.path === adj.fileId);
          if (file) file.depth = adj.newDepth;
        }
        result = packFn(files, budget, adjustments[0]?.newDepth ?? depth);
      }
    }
    return result;
  };
}
