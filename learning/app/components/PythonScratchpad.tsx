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

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type PythonScratchpadProps = {
  starterCode?: string;
  programContext?: string; // Full program code to prepend during execution
  onExecute?: (code: string, output: string, error: string | null) => void;
  onCodeChange?: (code: string) => void;
};

export default function PythonScratchpad({ 
  starterCode = '',
  programContext = '',
  onExecute,
  onCodeChange
}: PythonScratchpadProps) {
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'graphics'>('console');
  const pyodideRef = useRef<any>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Update code when starterCode prop changes
  useEffect(() => {
    if (starterCode) {
      setCode(starterCode);
    }
  }, [starterCode]);

  // Initialize Pyodide on mount
  useEffect(() => {
    async function loadPyodide() {
      try {
        // @ts-ignore - Pyodide loads from CDN
        const pyodide = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/',
        });
        
        // Load commonly used packages
        await pyodide.loadPackage(['numpy', 'matplotlib', 'micropip']);
        
        pyodideRef.current = pyodide;
        setIsLoading(false);
        console.log('✅ Pyodide loaded successfully with numpy, matplotlib, micropip');
      } catch (err) {
        console.error('Failed to load Pyodide:', err);
        setError('Failed to initialize Python environment');
        setIsLoading(false);
      }
    }

    loadPyodide();
  }, []);

  const runCode = async () => {
    if (!pyodideRef.current) {
      setError('Python environment not ready');
      return;
    }

    setIsRunning(true);
    setError(null);
    setOutput('');

    try {
      const pyodide = pyodideRef.current;
      
      // Capture stdout
      pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
      `);

      // Prepend program context if available, then run user code
      const fullCode = programContext ? `${programContext}\n\n${code}` : code;
      await pyodide.runPythonAsync(fullCode);

      // Get captured output
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      
      const finalOutput = stdout || '(no output)';
      setOutput(finalOutput);
      onExecute?.(code, finalOutput, null);
      
      // Auto-scroll to bottom after a brief delay
      setTimeout(() => {
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }, 50);
      
    } catch (err: any) {
      const errorMsg = err.message || 'Execution error';
      setError(errorMsg);
      onExecute?.(code, '', errorMsg);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runCode();
    }
    
    // Tab support in textarea
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      setCode(code.substring(0, start) + '    ' + code.substring(end));
      
      // Move cursor after inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-slate-800 text-white rounded-t-lg">
        <span className="text-sm font-medium">🐍 Python Workspace</span>
        <div className="flex gap-2">
          <Button
            onClick={runCode}
            disabled={isLoading || isRunning}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {isRunning ? '⏳ Running...' : '▶️ Run (Ctrl+Enter)'}
          </Button>
          <Button
            onClick={() => {
              setCode('');
              setOutput('');
              setError(null);
            }}
            size="sm"
            variant="outline"
            className="text-slate-300 border-slate-600 hover:bg-slate-700"
          >
            🔄 Clear
          </Button>
        </div>
      </div>

      {/* Code editor */}
      <div className="flex-1 p-3 overflow-hidden">
        <Textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            onCodeChange?.(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "Loading Python..." : starterCode}
          disabled={isLoading}
          className="font-mono text-sm h-full resize-none bg-white overflow-y-auto"
          style={{ minHeight: '200px' }}
        />
      </div>

      {/* Output area */}
      {(output || error) && (
        <div className="border-t bg-slate-900 text-white rounded-b-lg">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === 'console'
                  ? 'bg-slate-800 text-white border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              📝 Console
            </button>
            <button
              disabled
              className="px-4 py-2 text-xs font-medium text-slate-600 cursor-not-allowed opacity-50"
            >
              📊 Graphics
            </button>
            <div className="flex-1" />
            <button
              onClick={() => {
                setOutput('');
                setError(null);
              }}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              Clear
            </button>
          </div>

          {/* Output content */}
          <div ref={outputRef} className="p-3 overflow-y-auto" style={{ maxHeight: '300px' }}>
            {error ? (
              <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap">{error}</pre>
            ) : (
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{output || '(no output)'}</pre>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="border-t p-3 bg-yellow-50 text-yellow-800 text-sm">
          ⏳ Loading Python environment... (first time only, ~10-15 seconds)
        </div>
      )}
    </div>
  );
}
