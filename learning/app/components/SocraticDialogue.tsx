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

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import PythonScratchpad from './PythonScratchpad';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  assessment?: MasteryAssessment;
};

type MasteryAssessment = {
  indicators_demonstrated: string[];
  confidence: number;
  ready_for_mastery: boolean;
  next_focus?: string;
};

type SocraticDialogueProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conceptData: any;
  embeddingsPath: string;
  onMasteryAchieved?: (conceptId: string) => void;
};

export default function SocraticDialogue({
  open,
  onOpenChange,
  conceptData,
  embeddingsPath,
  onMasteryAchieved,
}: SocraticDialogueProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [demonstratedSkills, setDemonstratedSkills] = useState<Set<string>>(new Set());
  const [readyForMastery, setReadyForMastery] = useState(false);
  const [textbookContext, setTextbookContext] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [evaluation, setEvaluation] = useState<{
    output: string;
    error: string | null;
  } | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<{
    input: string;
    code: string;
    evaluation: any;
    conversationHistory: any[];
  } | null>(null);
  const [lastSentCode, setLastSentCode] = useState<string>('');
  const [lastSentEvaluation, setLastSentEvaluation] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus textarea when loading completes
  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  // Start the dialogue when modal opens
  useEffect(() => {
    if (open && !hasStarted) {
      startDialogue();
    }
  }, [open, hasStarted]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setHasStarted(false);
      setInput('');
      setDemonstratedSkills(new Set());
      setReadyForMastery(false);
      setTextbookContext(null);
      setCode('');
      setEvaluation(null);
      setLastSentCode('');
      setLastSentEvaluation(null);
    }
  }, [open]);

  const startDialogue = async () => {
    setIsLoading(true);
    setHasStarted(true);

    try {
      const response = await fetch('/api/socratic-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptId: conceptData.id,
          conversationHistory: [],
          conceptData,
          textbookContext: null, // Signal: please do semantic search
          embeddingsPath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start dialogue');
      }

      const data = await response.json();
      
      // Cache the textbook context for subsequent turns
      if (data.textbookContext) {
        setTextbookContext(data.textbookContext);
        console.log('📦 Cached textbook context:', data.textbookContext.length, 'characters');
      }
      
      // Update demonstrated skills if assessment provided
      if (data.mastery_assessment) {
        const newSkills = new Set(demonstratedSkills);
        data.mastery_assessment.indicators_demonstrated.forEach((skill: string) => 
          newSkills.add(skill)
        );
        setDemonstratedSkills(newSkills);
        setReadyForMastery(data.mastery_assessment.ready_for_mastery);
      }
      
      setMessages([{ 
        role: 'assistant', 
        content: data.message,
        assessment: data.mastery_assessment 
      }]);
    } catch (error) {
      console.error('Error starting dialogue:', error);
      setMessages([
        {
          role: 'assistant',
          content: error instanceof Error 
            ? `Error: ${error.message}` 
            : 'Sorry, I encountered an error starting the dialogue. Please check that your API key is configured in .env.local',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (retryData?: {
    input: string;
    code: string;
    evaluation: any;
    conversationHistory: any[];
  }) => {
    const currentInput = retryData?.input ?? input.trim();
    const currentCode = retryData?.code ?? code.trim();
    const currentEval = retryData?.evaluation ?? evaluation;
    
    const hasText = currentInput.length > 0;
    const hasCode = currentCode.length > 0;
    
    if ((!hasText && !hasCode) || isLoading) return;

    // Check what actually changed since last turn
    const codeChanged = currentCode !== lastSentCode;
    const evalChanged = JSON.stringify(currentEval) !== JSON.stringify(lastSentEvaluation);

    // For UI display: just show the text (code is already visible in workspace)
    const displayContent = hasText ? currentInput : '(working in Python workspace)';
    
    // For API: only include code/evaluation if they changed
    let apiContent = currentInput || '(sharing code)';
    
    if (codeChanged && currentCode) {
      apiContent += `\n\n**My Code:**\n\`\`\`python\n${currentCode}\n\`\`\``;
    }
    
    if (evalChanged && currentEval) {
      if (currentEval.error) {
        apiContent += `\n\n**Error:**\n${currentEval.error}`;
      } else {
        apiContent += `\n\n**Output:**\n${currentEval.output || '(no output)'}`;
      }
    }

    // Display clean version in UI
    const userMessage: Message = { role: 'user', content: displayContent };
    const updatedMessages = retryData 
      ? [...messages.slice(0, -1), userMessage] // Replace error message
      : [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Clear input only if not retrying
    if (!retryData) {
      setInput('');
    }
    
    setIsLoading(true);
    setLastFailedMessage(null); // Clear any previous failure

    try {
      // Send full context to API
      const conversationHistory = retryData?.conversationHistory ?? 
        updatedMessages.slice(0, -1).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
      
      // Add current message with full context (code + eval)
      conversationHistory.push({
        role: 'user',
        content: apiContent
      });

      const response = await fetch('/api/socratic-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptId: conceptData.id,
          conversationHistory,
          conceptData,
          textbookContext,
          embeddingsPath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Update demonstrated skills if assessment provided
      if (data.mastery_assessment) {
        const newSkills = new Set(demonstratedSkills);
        data.mastery_assessment.indicators_demonstrated.forEach((skill: string) => 
          newSkills.add(skill)
        );
        setDemonstratedSkills(newSkills);
        setReadyForMastery(data.mastery_assessment.ready_for_mastery);
      }
      
      // Update tracking for next turn - only if they were actually sent
      if (codeChanged) setLastSentCode(currentCode);
      if (evalChanged) setLastSentEvaluation(currentEval);
      
      setMessages([...updatedMessages, { 
        role: 'assistant', 
        content: data.message,
        assessment: data.mastery_assessment 
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Save failed message for retry
      setLastFailedMessage({
        input: currentInput,
        code: currentCode,
        evaluation: currentEval,
        conversationHistory: updatedMessages.slice(0, -1).map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: `⚠️ **Error:** ${errorMessage}\n\nYour message was saved. Click the retry button below to try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleMarkAsMastered = () => {
    console.log('Concept mastered:', conceptData.id);
    
    // Call the parent callback to update mastery state
    if (onMasteryAchieved) {
      onMasteryAchieved(conceptData.id);
    }
    
    // Show success message and close dialogue
    alert(`🎉 Concept "${conceptData.name}" marked as mastered!\n\nThe graph has been updated!`);
    onOpenChange(false);
  };

  if (!conceptData) return null;

  // Calculate progress
  const totalIndicators = conceptData.mastery_indicators?.length || 0;
  const demonstratedCount = demonstratedSkills.size;
  const progressPercent = totalIndicators > 0 ? (demonstratedCount / totalIndicators) * 100 : 0;

  // Show Python scratchpad by default (can opt-out with hide_editor: true)
  const showPythonEditor = conceptData.hide_editor !== true;

  // Send button: enabled if text OR code exists
  const canSend = !isLoading && (input.trim().length > 0 || code.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${showPythonEditor ? '!max-w-[96vw] w-[96vw]' : 'max-w-3xl'} !h-[90vh] flex flex-col p-4`}>
        <DialogHeader>
          <DialogTitle>Learning: {conceptData.name}</DialogTitle>
          <DialogDescription>{conceptData.description}</DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {totalIndicators > 0 ? (
          <div className="px-4 py-2 bg-slate-50 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress:</span>
              <span className="text-slate-600">
                {demonstratedCount} / {totalIndicators} skills demonstrated
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {readyForMastery && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-green-600 font-medium">
                  ✨ Ready for mastery!
                </span>
                <Button 
                  onClick={handleMarkAsMastered}
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Mark as Mastered
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Fallback for concepts without explicit mastery indicators
          readyForMastery && (
            <div className="px-4 py-2 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-600 font-medium">
                  ✨ Ready for mastery!
                </span>
                <Button 
                  onClick={handleMarkAsMastered}
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Mark as Mastered
                </Button>
              </div>
            </div>
          )
        )}

        {/* Main content area */}
        <div className="flex-1 flex gap-4 overflow-auto">
          {/* Messages area (left side or full width) */}
          <div className={`${showPythonEditor ? 'flex-1 min-w-0' : 'w-full'} flex flex-col`}>
            <div className="flex-1 overflow-y-auto space-y-4 py-4 px-2">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <div className={`text-sm prose prose-sm max-w-none prose-p:my-2 prose-pre:my-2 ${
                  msg.role === 'user' ? 'prose-invert' : 'prose-slate'
                }`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
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
                            className={`${className} px-1 py-0.5 rounded text-xs ${
                              msg.role === 'user' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-slate-200 text-slate-900'
                            }`} 
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg px-4 py-2">
                <p className="text-sm text-slate-600">Thinking...</p>
              </div>
            </div>
          )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="space-y-2 pt-4 border-t">
              {lastFailedMessage && (
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-sm text-amber-800">
                    💬 Previous message failed - click retry to send again
                  </span>
                  <Button 
                    onClick={retryLastMessage}
                    variant="default"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={isLoading}
                  >
                    Retry
                  </Button>
                </div>
              )}
              
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your response... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 min-h-[60px] max-h-[120px]"
                  disabled={isLoading}
                />
                <Button onClick={() => sendMessage()} disabled={!canSend}>
                  Send
                </Button>
              </div>
            </div>
          </div>

          {/* Python Scratchpad (right side) - shown by default */}
          {showPythonEditor && (
            <div className="flex-1 min-w-0 border-l pl-3 flex flex-col">
              <PythonScratchpad
                starterCode={`# 🧮 Python scratchpad for exploring ${conceptData.name}
# 
# Feel free to experiment here! You can:
# - Test out ideas in code
# - Answer questions by implementing solutions
# - Work through examples
# 
# Your code and output will be visible to your tutor.
`}
                onExecute={(execCode, output, error) => {
                  setEvaluation({ output, error });
                }}
                onCodeChange={(newCode) => {
                  setCode(newCode);
                }}
              />
            </div>
          )}
        </div>

        {/* Learning objectives reference */}
        {conceptData.learning_objectives && (
          <div className="text-xs text-slate-500 pt-2 border-t">
            <strong>Objectives:</strong>{' '}
            {conceptData.learning_objectives.join(' • ')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
