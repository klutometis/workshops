'use client';

import { useEffect, useState, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw'; // Add this import
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type MarkdownViewerProps = {
  markdownContent: string;  // The markdown content to display
  scrollToAnchor?: string;  // e.g., 'nearest-neighbor-algorithm'
};

export const MarkdownViewer = memo(function MarkdownViewer({ markdownContent, scrollToAnchor }: MarkdownViewerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to anchor after content loads
  useEffect(() => {
    if (!loading && scrollToAnchor && containerRef.current) {
      setTimeout(() => {
        const element = document.getElementById(scrollToAnchor);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          element.style.backgroundColor = '#fef3c7'; // Highlight in yellow
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);
        }
      }, 100);
    }
  }, [loading, scrollToAnchor]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="h-full overflow-y-auto p-6 bg-white"
    >
      <div className="prose max-w-none prose-headings:text-slate-900 prose-p:text-slate-700">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeSlug, rehypeRaw]}
          components={{
            h1: ({ node, ...props }) => (
              <h1 className="text-4xl font-extrabold text-slate-900" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-5 my-4 space-y-2" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="text-slate-700 leading-relaxed" {...props} />
            ),
            a: ({ node, ...props }) => (
              <a className="text-blue-600 hover:underline font-normal underline" {...props} />
            ),
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code 
                  className={`${className} px-1 py-0.5 rounded text-xs bg-slate-100 text-slate-900`}
                  {...props}
                >
                  {children}
                </code>
              );
            },
          }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if content or anchor actually changed
  return prevProps.markdownContent === nextProps.markdownContent &&
         prevProps.scrollToAnchor === nextProps.scrollToAnchor;
});
