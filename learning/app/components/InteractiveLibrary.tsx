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

import { useState, useEffect } from 'react';
import ConceptGraph from './ConceptGraph';
import ConceptDetails from './ConceptDetails';
import SocraticDialogue from './SocraticDialogue';
import GraphModal from './GraphModal';
import { Map as MapIcon } from 'lucide-react';

type Library = {
  id: string;
  title: string;
  author?: string;
  type: string;
  conceptGraphPath?: string;
  conceptGraphData?: any;
};

type ConceptGraphData = {
  metadata: any;
  concepts?: any[];
  nodes?: any[];
  edges: any[];
  source_type?: string;
  notebook_data?: any;
};

type MasteryRecord = {
  conceptId: string;
  masteredAt: number;
};

type InteractiveLibraryProps = {
  library: Library;
  onBack?: () => void;
  backLabel?: string;
};

export default function InteractiveLibrary({ library, onBack, backLabel = '← Back to Libraries' }: InteractiveLibraryProps) {
  const [conceptGraphData, setConceptGraphData] = useState<ConceptGraphData | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [dialogueOpen, setDialogueOpen] = useState(false);
  const [masteredConcepts, setMasteredConcepts] = useState<Map<string, MasteryRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [autoStarted, setAutoStarted] = useState(false);
  const [graphModalOpen, setGraphModalOpen] = useState(false);

  // Load concept graph when library is loaded
  useEffect(() => {
    // If concept graph data is provided directly, use it
    if (library.conceptGraphData) {
      setConceptGraphData(library.conceptGraphData);
      setLoading(false);
      return;
    }

    // Otherwise load from path
    if (!library.conceptGraphPath) {
      console.error('No concept graph path or data provided');
      setLoading(false);
      return;
    }

    fetch(library.conceptGraphPath)
      .then(res => res.json())
      .then(data => {
        setConceptGraphData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load concept graph:', err);
        setLoading(false);
      });
  }, [library.conceptGraphPath, library.conceptGraphData]);

  // Load mastered concepts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`pcg-mastery-${library.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert object to Map
        const map = new Map<string, MasteryRecord>(
          Object.entries(parsed).map(([id, record]) => [id, record as MasteryRecord])
        );
        setMasteredConcepts(map);
      } catch (e) {
        console.error('Failed to load mastery data:', e);
      }
    }
  }, [library.id]);

  // Save mastered concepts to localStorage whenever it changes
  useEffect(() => {
    if (masteredConcepts.size > 0) {
      // Convert Map to object for JSON storage
      const obj = Object.fromEntries(masteredConcepts.entries());
      localStorage.setItem(`pcg-mastery-${library.id}`, JSON.stringify(obj));
    }
  }, [masteredConcepts, library.id]);

  // Auto-start lesson with first recommended concept
  useEffect(() => {
    if (loading || !conceptGraphData || autoStarted) return;
    
    const concepts = conceptGraphData.concepts || conceptGraphData.nodes || [];
    if (concepts.length === 0) return;

    // Calculate ready concepts
    const readyConcepts = concepts.filter((c: any) => 
      !masteredConcepts.has(c.id) &&
      (c.prerequisites || []).every((p: string) => masteredConcepts.has(p))
    );

    if (readyConcepts.length > 0) {
      // Use recommendation algorithm to pick best starting concept
      const difficultyRank: Record<string, number> = {
        basic: 1,
        intermediate: 2,
        advanced: 3,
      };

      const countUnlocks = (conceptId: string): number => {
        return concepts.filter((c: any) =>
          (c.prerequisites || []).includes(conceptId)
        ).length;
      };

      const recommended = readyConcepts
        .sort((a: any, b: any) => {
          if (a.difficulty !== b.difficulty) {
            return difficultyRank[a.difficulty] - difficultyRank[b.difficulty];
          }
          return countUnlocks(b.id) - countUnlocks(a.id);
        });

      const firstConcept = recommended[0];
      console.log(`🚀 Auto-starting lesson with: ${firstConcept.name}`);
      setSelectedConceptId(firstConcept.id);
      setDialogueOpen(true);
      setAutoStarted(true);
    } else if (masteredConcepts.size === concepts.length) {
      // All concepts mastered!
      console.log('🏆 All concepts mastered!');
      setAutoStarted(true);
    }
  }, [loading, conceptGraphData, masteredConcepts, autoStarted]);

  // Show loading state
  if (loading || !conceptGraphData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading library...</div>
      </div>
    );
  }

  // Accept both 'concepts' and 'nodes' field names
  const concepts = conceptGraphData.concepts || conceptGraphData.nodes || [];
  
  // Check if this is a notebook (has notebook_data)
  const sourceType = conceptGraphData.source_type || 'markdown';
  const notebookData = conceptGraphData.notebook_data;
  
  const selectedConcept = selectedConceptId
    ? concepts.find((c) => c.id === selectedConceptId) || null
    : null;

  // Calculate statistics
  const totalConcepts = concepts.length;
  const masteredCount = masteredConcepts.size;
  const masteredPercent = Math.round((masteredCount / totalConcepts) * 100);

  // Ready concepts: all prerequisites mastered, but not yet mastered itself
  const readyConcepts = concepts.filter(c => 
    !masteredConcepts.has(c.id) &&
    (c.prerequisites || []).every((p: string) => masteredConcepts.has(p))
  );

  // Locked concepts: missing at least one prerequisite
  const lockedConcepts = concepts.filter(c =>
    !masteredConcepts.has(c.id) &&
    (c.prerequisites || []).some((p: string) => !masteredConcepts.has(p))
  );

  // Recommended concepts: Top 3-5 ready concepts, prioritized by:
  // 1. Difficulty (basic first)
  // 2. Number of concepts they unlock
  const difficultyRank: Record<string, number> = {
    basic: 1,
    intermediate: 2,
    advanced: 3,
  };

  const countUnlocks = (conceptId: string): number => {
    return concepts.filter(c =>
      (c.prerequisites || []).includes(conceptId)
    ).length;
  };

  const recommendedConcepts = readyConcepts
    .sort((a, b) => {
      // Sort by difficulty first
      if (a.difficulty !== b.difficulty) {
        return difficultyRank[a.difficulty] - difficultyRank[b.difficulty];
      }
      // Then by unlock potential
      return countUnlocks(b.id) - countUnlocks(a.id);
    })
    .slice(0, 5); // Top 5 recommendations

  const recommendedConceptIds = new Set(recommendedConcepts.map(c => c.id));

  // Determine status of selected concept
  const getConceptStatus = (conceptId: string | null): 'mastered' | 'recommended' | 'ready' | 'locked' | null => {
    if (!conceptId) return null;
    if (masteredConcepts.has(conceptId)) return 'mastered';
    if (recommendedConceptIds.has(conceptId)) return 'recommended';
    if (readyConcepts.some(c => c.id === conceptId)) return 'ready';
    if (lockedConcepts.some(c => c.id === conceptId)) return 'locked';
    return null;
  };

  const handleStartLearning = (conceptId: string) => {
    setDialogueOpen(true);
  };

  const handleMasteryAchieved = async (conceptId: string, nextConceptId?: string) => {
    // Import confetti dynamically
    const confetti = (await import('canvas-confetti')).default;
    
    // Trigger confetti celebration!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Update mastered concepts
    setMasteredConcepts(prev => {
      const next = new Map(prev);
      next.set(conceptId, {
        conceptId,
        masteredAt: Date.now(),
      });
      return next;
    });
  };

  const handleConceptChange = (newConceptId: string) => {
    console.log('📍 Concept changed to:', newConceptId);
    // Update selected concept (this will update the concept title/description in UI)
    setSelectedConceptId(newConceptId);
  };

  // Handle concept selection from graph modal
  const handleNodeSelect = (conceptId: string) => {
    setSelectedConceptId(conceptId);
    if (!dialogueOpen) {
      setDialogueOpen(true);
    }
  };

  // All concepts mastered - show completion
  if (!loading && masteredConcepts.size === concepts.length && concepts.length > 0) {
    return (
      <div className="h-screen flex flex-col">
        <header className="bg-slate-900 text-white p-4">
          <div className="flex items-center justify-between">
            <div>
              {onBack && (
                <button 
                  onClick={onBack}
                  className="text-sm text-slate-300 hover:text-white mb-1 transition-colors"
                >
                  {backLabel}
                </button>
              )}
              <h1 className="text-2xl font-bold">{library.title}</h1>
              {library.author && (
                <p className="text-sm text-slate-100">by {library.author}</p>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <div className="text-6xl mb-6">🏆</div>
            <h2 className="text-4xl font-bold mb-4">Congratulations!</h2>
            <p className="text-xl text-slate-600 mb-6">
              You've mastered all {concepts.length} concepts in this library!
            </p>
            <button
              onClick={() => setGraphModalOpen(true)}
              className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Review Concept Map
            </button>
          </div>
        </div>

        <GraphModal
          open={graphModalOpen}
          onClose={() => setGraphModalOpen(false)}
          onNodeSelect={handleNodeSelect}
          graphData={conceptGraphData}
          masteredConcepts={masteredConcepts}
          recommendedConcepts={recommendedConceptIds}
          readyConcepts={new Set(readyConcepts.map(c => c.id))}
          lockedConcepts={new Set(lockedConcepts.map(c => c.id))}
          selectedConceptId={selectedConceptId}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Progress Bar and Show Map Button */}
      <header className="bg-slate-900 text-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            {onBack && (
              <button 
                onClick={onBack}
                className="text-sm text-slate-300 hover:text-white mb-1 transition-colors"
              >
                {backLabel}
              </button>
            )}
            <h1 className="text-2xl font-bold">{library.title}</h1>
            {library.author && (
              <p className="text-sm text-slate-100">by {library.author}</p>
            )}
          </div>

          <button
            onClick={() => setGraphModalOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <MapIcon className="w-4 h-4" />
            <span>Show Map</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-slate-300">Progress</span>
            <span className="text-sm font-bold text-white">
              {masteredCount} / {totalConcepts} ({masteredPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${masteredPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main content - Full screen lesson */}
      <div className="flex-1 overflow-hidden">
        {selectedConcept && dialogueOpen ? (
          <SocraticDialogue
            open={dialogueOpen}
            onOpenChange={setDialogueOpen}
            conceptData={selectedConcept}
            libraryId={library.id}
            libraryType={library.type}
            onMasteryAchieved={handleMasteryAchieved}
            inline={true}
            conceptGraph={conceptGraphData}
            masteredConcepts={Array.from(masteredConcepts.keys())}
            onConceptChange={handleConceptChange}
          />
        ) : (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-2xl">
              <div className="text-6xl mb-6">📚</div>
              <h2 className="text-3xl font-bold mb-4">Loading your lesson...</h2>
              <p className="text-lg text-slate-600">
                Preparing the first concept for you to learn.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Graph Modal */}
      <GraphModal
        open={graphModalOpen}
        onClose={() => setGraphModalOpen(false)}
        onNodeSelect={handleNodeSelect}
        graphData={conceptGraphData}
        masteredConcepts={masteredConcepts}
        recommendedConcepts={recommendedConceptIds}
        readyConcepts={new Set(readyConcepts.map(c => c.id))}
        lockedConcepts={new Set(lockedConcepts.map(c => c.id))}
        selectedConceptId={selectedConceptId}
      />
    </div>
  );
}
