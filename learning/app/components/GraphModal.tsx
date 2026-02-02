/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';

import ConceptGraph from './ConceptGraph';
import { X } from 'lucide-react';

type GraphModalProps = {
  open: boolean;
  onClose: () => void;
  onNodeSelect: (conceptId: string) => void;
  graphData: any;
  masteredConcepts: Map<string, any>;
  recommendedConcepts: Set<string>;
  readyConcepts: Set<string>;
  lockedConcepts: Set<string>;
  selectedConceptId: string | null;
};

export default function GraphModal({
  open,
  onClose,
  onNodeSelect,
  graphData,
  masteredConcepts,
  recommendedConcepts,
  readyConcepts,
  lockedConcepts,
  selectedConceptId,
}: GraphModalProps) {
  if (!open) return null;

  const handleNodeClick = (conceptId: string) => {
    onNodeSelect(conceptId);
    onClose(); // Close modal after selection
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-6xl w-full h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-900 text-white rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold">Concept Map</h2>
            <p className="text-sm text-slate-300">Click a concept to switch to it</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Graph */}
        <div className="flex-1 overflow-hidden">
          <ConceptGraph
            data={graphData}
            onNodeClick={handleNodeClick}
            masteredConcepts={masteredConcepts}
            recommendedConcepts={recommendedConcepts}
            readyConcepts={readyConcepts}
            lockedConcepts={lockedConcepts}
          />
        </div>

        {/* Legend */}
        <div className="p-4 border-t bg-slate-50">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span>Mastered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span>Recommended</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span>Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-400"></div>
              <span>Locked</span>
            </div>
            {selectedConceptId && (
              <div className="flex items-center gap-2 ml-auto">
                <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-purple-700"></div>
                <span className="font-medium">Currently Learning</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
