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

import { useEffect, useRef, useState } from 'react';

type NotebookViewerProps = {
  notebook: any; // Jupyter notebook JSON structure
};

// Declare global types for CDN-loaded libraries
declare global {
  interface Window {
    nb?: any;
  }
}

export default function NotebookViewer({ notebook }: NotebookViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load notebookjs from CDN
  useEffect(() => {
    if (window.nb) {
      setIsLoaded(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/notebookjs/notebook.min.js';
    script.onload = () => setIsLoaded(true);
    script.onerror = () => console.error('Failed to load notebookjs from CDN');
    document.head.appendChild(script);
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  
  // Render notebook when library is loaded
  useEffect(() => {
    if (!isLoaded || !containerRef.current || !notebook || !window.nb) return;
    
    try {
      // Parse and render notebook
      const parsed = window.nb.parse(notebook);
      const rendered = parsed.render();
      
      // Clear and append
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(rendered);
    } catch (error) {
      console.error('Failed to render notebook:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = '<div class="text-red-500 p-4">Failed to render notebook</div>';
      }
    }
  }, [isLoaded, notebook]);
  
  if (!isLoaded) {
    return (
      <div className="notebook-viewer-container bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="text-slate-600">Loading notebook viewer...</div>
      </div>
    );
  }
  
  return (
    <div className="notebook-viewer-container bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div 
        ref={containerRef} 
        className="notebook-content p-6"
      />
      
      <style jsx global>{`
        /* Notebook container styles */
        .notebook-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #24292e;
        }
        
        /* Cell styles */
        .notebook-content .cell {
          margin-bottom: 1.5rem;
        }
        
        /* Code cell styles */
        .notebook-content .cell.code {
          border-left: 3px solid #0066cc;
          padding-left: 1rem;
        }
        
        .notebook-content .input pre {
          background: #f6f8fa;
          border: 1px solid #e1e4e8;
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.45;
        }
        
        .notebook-content .input code {
          background: transparent;
          padding: 0;
          font-family: inherit;
        }
        
        /* Output styles */
        .notebook-content .output {
          margin-top: 0.5rem;
          padding-left: 1rem;
        }
        
        .notebook-content .output pre {
          background: #ffffff;
          border: 1px solid #e1e4e8;
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 13px;
        }
        
        /* Markdown cell styles */
        .notebook-content .cell.markdown {
          padding-left: 0.5rem;
        }
        
        /* Markdown typography */
        .notebook-content .cell.markdown h1 {
          font-size: 2em;
          font-weight: 600;
          margin-top: 24px;
          margin-bottom: 16px;
          border-bottom: 1px solid #e1e4e8;
          padding-bottom: 0.3em;
        }
        
        .notebook-content .cell.markdown h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin-top: 24px;
          margin-bottom: 16px;
          border-bottom: 1px solid #e1e4e8;
          padding-bottom: 0.3em;
        }
        
        .notebook-content .cell.markdown h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-top: 24px;
          margin-bottom: 16px;
        }
        
        .notebook-content .cell.markdown p {
          margin-top: 0;
          margin-bottom: 16px;
        }
        
        .notebook-content .cell.markdown ul,
        .notebook-content .cell.markdown ol {
          margin-bottom: 16px;
          padding-left: 2em;
        }
        
        .notebook-content .cell.markdown code {
          background: #f6f8fa;
          border-radius: 3px;
          padding: 0.2em 0.4em;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 85%;
        }
        
        .notebook-content .cell.markdown pre code {
          background: transparent;
          padding: 0;
        }
        
        .notebook-content .cell.markdown blockquote {
          border-left: 4px solid #dfe2e5;
          padding-left: 1em;
          margin-left: 0;
          color: #6a737d;
        }
        
        .notebook-content .cell.markdown a {
          color: #0366d6;
          text-decoration: none;
        }
        
        .notebook-content .cell.markdown a:hover {
          text-decoration: underline;
        }
        
        /* Table styles */
        .notebook-content table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
        }
        
        .notebook-content table th,
        .notebook-content table td {
          border: 1px solid #dfe2e5;
          padding: 6px 13px;
        }
        
        .notebook-content table th {
          background: #f6f8fa;
          font-weight: 600;
        }
        
        .notebook-content table tr:nth-child(2n) {
          background: #f6f8fa;
        }
        
        /* Image styles */
        .notebook-content img {
          max-width: 100%;
          height: auto;
          margin: 16px 0;
        }
      `}</style>
    </div>
  );
}
