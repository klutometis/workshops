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

import { NextRequest, NextResponse } from 'next/server';
import { getLibraryBySlug, searchSegments } from '@/lib/db';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// Generate embedding for a concept query
async function embedConceptQuery(conceptName: string, apiKey: string): Promise<number[]> {
  // Use just the concept name - cast a wide net and let semantic search do its magic
  const queryText = conceptName;
  
  console.log('   🔍 Embedding query:', queryText);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-embedding-001',
        content: {
          parts: [{ text: queryText }]
        },
        outputDimensionality: 1536
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API failed: ${error}`);
  }
  
  const data = await response.json();
  return data.embedding.values;
}

// Load textbook sections using database semantic search
async function loadConceptContext(
  conceptId: string, 
  conceptData: any,
  apiKey: string,
  libraryId: string,
  topK: number = 5
): Promise<{text: string; chunks: any[]}> {
  try {
    console.log(`   🔍 Looking up library by slug: ${libraryId}`);
    
    // Get library from database using human-readable slug
    const library = await getLibraryBySlug(libraryId);
    if (!library) {
      console.log(`   ⚠️ Library not found in database: ${libraryId}`);
      return {text: '(No textbook sections found for this concept)', chunks: []};
    }
    
    console.log(`   📚 Found in database: ${library.title}`);
    console.log(`   🗄️  Type: ${library.type}, Video ID: ${library.video_id || 'N/A'}`);
    console.log(`   ✅ USING DATABASE (not disk files)`);
    
    // Get embedding for the concept query
    const conceptEmbedding = await embedConceptQuery(conceptData.name, apiKey);
    
    console.log(`   🧮 Querying database with ${conceptEmbedding.length}-dim embedding...`);
    
    // Search database using pgvector similarity
    const segments = await searchSegments(
      conceptEmbedding,
      library.id,
      0.5, // similarity threshold
      topK
    );
    
    // For video libraries: re-sort chronologically (not by similarity)
    // This ensures video starts from the beginning, not jumping around
    if (library.type === 'youtube' && segments.length > 0) {
      segments.sort((a, b) => (a.audio_start || 0) - (b.audio_start || 0));
      console.log('   📹 Re-sorted video segments chronologically');
    }
    
    if (segments.length === 0) {
      console.log('   ⚠️ No matching segments found');
      return {text: '(No textbook sections found for this concept)', chunks: []};
    }
    
    console.log(`   ✅ Found ${segments.length} segments by similarity:`);
    segments.forEach((seg: any, i: number) => {
      const label = seg.audio_text?.substring(0, 60) || 'Untitled';
      console.log(`      ${i + 1}. [${seg.similarity.toFixed(3)}] ${label}`);
      if (seg.key_concepts) {
        console.log(`         Key concepts: ${seg.key_concepts.join(', ')}`);
      }
    });
    
    // Format the most relevant segments for LLM with rich multimodal content
    const formattedText = segments
      .map((seg: any) => {
        // Use segment_timestamp (not timestamp which doesn't exist)
        const timestamp = seg.segment_timestamp || 0;
        const minutes = Math.floor(timestamp / 60);
        const seconds = Math.floor(timestamp % 60);
        const title = `Timestamp ${minutes}:${String(seconds).padStart(2, '0')}`;
        
        // Build rich content from all available fields
        const parts: string[] = [];
        
        if (seg.audio_text && seg.audio_text.trim()) {
          parts.push(`**Transcript:** ${seg.audio_text}`);
        }
        
        if (seg.visual_description && seg.visual_description.trim()) {
          parts.push(`**Visual:** ${seg.visual_description}`);
        }
        
        if (seg.code_content && seg.code_content.trim()) {
          parts.push(`**Code:**\n\`\`\`\n${seg.code_content}\n\`\`\``);
        }
        
        if (seg.slide_content && seg.slide_content.trim()) {
          parts.push(`**Slides:** ${seg.slide_content}`);
        }
        
        if (seg.key_concepts && seg.key_concepts.length > 0) {
          parts.push(`**Key Concepts:** ${seg.key_concepts.join(', ')}`);
        }
        
        const content = parts.length > 0 ? parts.join('\n\n') : '(no content)';
        
        return `**[VIDEO] ${title}** (similarity: ${(seg.similarity * 100).toFixed(1)}%)\n\n${content}`;
      })
      .join('\n\n---\n\n');
    
    // Return BOTH formatted text AND raw chunks with provenance
    return {
      text: formattedText,
      chunks: segments.map((seg: any) => ({
        text: seg.audio_text,
        topic: null,
        chunk_type: 'video',
        similarity: seg.similarity,
        
        // Video metadata (use correct field names from database)
        video_id: library.video_id,
        timestamp: seg.segment_timestamp,
        segment_index: seg.segment_index,
        audio_text: seg.audio_text,
        audio_start: seg.audio_start,
        audio_end: seg.audio_end,
        visual_description: seg.visual_description,
        code_content: seg.code_content,
        slide_content: seg.slide_content,
        key_concepts: seg.key_concepts,
      }))
    };
      
  } catch (error) {
    console.error('   ❌ Error loading concept context:', error);
    return {text: '(Textbook context unavailable)', chunks: []};
  }
}

export async function POST(request: NextRequest) {
  try {
    const { conceptId, conversationHistory, conceptData, textbookContext, libraryId } = await request.json();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎓 NEW SOCRATIC DIALOGUE REQUEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 Concept ID:', conceptId);
    console.log('📌 Concept Name:', conceptData.name);
    console.log('📌 Conversation turns:', conversationHistory.length);
    console.log('📌 Textbook context:', textbookContext ? 'CACHED ✅' : 'NEEDS SEARCH 🔍');

    // Get API key from environment (prefer GOOGLE_API_KEY)
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Please add GOOGLE_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    // Use cached textbook context or perform semantic search
    let textbookSections = textbookContext;
    let sourceChunks: any[] = [];
    
    if (!textbookSections) {
      console.log('\n📚 SEMANTIC SEARCH (first turn):');
      const result = await loadConceptContext(conceptId, conceptData, apiKey, libraryId, 5);
      textbookSections = result.text;
      sourceChunks = result.chunks;
    } else {
      console.log('\n📚 REUSING CACHED CONTEXT:');
    }
    
    const chunksLoaded = textbookSections === '(No textbook sections found for this concept)' 
      ? 0 
      : textbookSections.split('---').length;
    
    console.log('\n📚 TEXTBOOK CONTEXT:');
    console.log(`   - Source: ${textbookContext ? 'CLIENT CACHE ✅' : 'SEMANTIC SEARCH 🔍'}`);
    console.log(`   - Chunks: ${chunksLoaded}`);
    console.log(`   - Characters: ${textbookSections.length}`);
    console.log(`   - Estimated tokens: ~${Math.ceil(textbookSections.length / 4)}`);
    if (chunksLoaded > 0 && chunksLoaded <= 3) {
      console.log('\n📖 Textbook sections preview:');
      console.log(textbookSections.substring(0, 500) + '...\n');
    }

    // Build system prompt with textbook grounding
    const systemPrompt = buildSocraticPrompt(conceptData, textbookSections);
    
    console.log('\n📝 SYSTEM PROMPT CONSTRUCTED:');
    console.log(`   - Total length: ${systemPrompt.length} characters`);
    console.log(`   - Estimated tokens: ~${Math.ceil(systemPrompt.length / 4)}`);
    console.log(`   - Learning objectives: ${conceptData.learning_objectives?.length || 0}`);
    console.log(`   - Mastery indicators: ${conceptData.mastery_indicators?.length || 0}`);

    // Convert conversation history to Gemini format
    // Gemini doesn't support system role, so we prepend it to the first user message
    const geminiContents = convertToGeminiFormat(systemPrompt, conversationHistory);
    
    console.log('\n📤 SENDING TO GEMINI:');
    console.log(`   - Total messages: ${geminiContents.length}`);
    const payload = JSON.stringify(geminiContents, null, 2);
    if (payload.length > 4000) {
      console.log(`   - Payload preview (${payload.length} chars total):`);
      console.log(payload.substring(0, 2000) + '\n...\n' + payload.substring(payload.length - 500));
    } else {
      console.log('   - Full payload:');
      console.log(payload);
    }

    // Call Google Gemini API with structured output
    const model = 'gemini-2.5-flash'; // Fast and intelligent model with best price-performance
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The Socratic dialogue response to the student',
                },
                mastery_assessment: {
                  type: 'object',
                  properties: {
                    indicators_demonstrated: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Array of skill IDs that the student demonstrated in this exchange',
                    },
                    confidence: {
                      type: 'number',
                      description: 'Confidence level (0-1) in the assessment',
                    },
                    ready_for_mastery: {
                      type: 'boolean',
                      description: 'True if student has demonstrated sufficient mastery to complete the concept',
                    },
                    next_focus: {
                      type: 'string',
                      description: 'Which skill or area to focus on next',
                    },
                  },
                  required: ['indicators_demonstrated', 'confidence', 'ready_for_mastery'],
                },
              },
              required: ['message', 'mastery_assessment'],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('\n❌ GEMINI API ERROR:');
      console.error(error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json(
        { error: 'Failed to get response from Gemini' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log('\n📥 RECEIVED FROM GEMINI:');
    console.log('   - Usage metadata:', JSON.stringify(data.usageMetadata, null, 2));
    console.log('   - Candidates:', data.candidates.length);
    
    // Find the text response (skip thought parts if using thinking mode)
    const textPart = data.candidates[0].content.parts.find(
      (part: any) => part.text !== undefined
    );
    
    if (!textPart) {
      console.error('\n❌ No text part found in response');
      console.error('   - Parts structure:', JSON.stringify(data.candidates[0].content.parts, null, 2));
      return NextResponse.json(
        { error: 'Invalid response structure from Gemini' },
        { status: 500 }
      );
    }
    
    const responseText = textPart.text;
    console.log('\n📄 RAW RESPONSE TEXT:');
    console.log(responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
    
    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
      console.log('\n✅ PARSED RESPONSE:');
      console.log('   - Message length:', parsedResponse.message.length);
      console.log('   - Indicators demonstrated:', parsedResponse.mastery_assessment.indicators_demonstrated);
      console.log('   - Confidence:', parsedResponse.mastery_assessment.confidence);
      console.log('   - Ready for mastery:', parsedResponse.mastery_assessment.ready_for_mastery);
    } catch (e) {
      console.error('\n❌ JSON PARSE ERROR:', e);
      console.error('   - Raw response:', responseText);
      
      // Detect if response was partial/truncated
      const isPartialResponse = responseText.trim().length > 0 && 
                               (responseText.includes('{') || responseText.includes('['));
      
      const errorMessage = isPartialResponse
        ? '⚠️ My response was incomplete (possibly truncated). Please click retry below to try again.'
        : '⚠️ I encountered an error generating my response. Please click retry below to try again.';
      
      // Show user-friendly error, not raw JSON
      parsedResponse = {
        message: errorMessage,
        mastery_assessment: {
          indicators_demonstrated: [],
          confidence: 0,
          ready_for_mastery: false,
          next_focus: 'Retry the request',
        },
      };
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      message: parsedResponse.message,
      mastery_assessment: parsedResponse.mastery_assessment,
      textbookContext: textbookSections,
      sources: sourceChunks,
      usage: data.usageMetadata,
    });

  } catch (error) {
    console.error('\n💥 UNEXPECTED ERROR:');
    console.error(error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Convert OpenAI-style messages to Gemini format
function convertToGeminiFormat(systemPrompt: string, conversationHistory: Message[]) {
  const contents: any[] = [];

  // If conversation is empty, add system prompt as first user message
  if (conversationHistory.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });
  } else {
    // Prepend system prompt to the first user message
    const firstUserMessage = conversationHistory.find((msg) => msg.role === 'user');
    const firstUserIndex = conversationHistory.findIndex((msg) => msg.role === 'user');
    
    conversationHistory.forEach((msg, index) => {
      if (msg.role === 'user') {
        // Add system prompt to first user message only
        const text = index === firstUserIndex
          ? `${systemPrompt}\n\n---\n\nStudent: ${msg.content}`
          : msg.content;
        
        contents.push({
          role: 'user',
          parts: [{ text }],
        });
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model', // Gemini uses 'model' instead of 'assistant'
          parts: [{ text: msg.content }],
        });
      }
    });
  }

  return contents;
}

// Build a Socratic teaching prompt using the concept's pedagogical data
function buildSocraticPrompt(
  conceptData: any, 
  textbookSections?: string
): string {
  const { name, description, learning_objectives, mastery_indicators, examples, misconceptions } = conceptData;

  return `You are a Socratic tutor teaching the concept: "${name}".

**Concept Description:** ${description}

${textbookSections ? `
**YOUR TEACHING MATERIAL (internalize this as your own knowledge):**

${textbookSections}

**CRITICAL INSTRUCTIONS FOR USING THIS MATERIAL:**
1. This is YOUR expert knowledge - teach from it naturally, never say "the textbook says..." or "based on the textbook..."
2. When referencing examples, SHOW them directly: "Consider this Lisp expression: (+ 2 3)..." not "based on the examples..."
3. Quote relevant passages when helpful: "In Lisp, parentheses indicate..." 
4. Use the specific terminology and concepts from above, but present them as your own teaching
5. If asking about an example, either show it inline or reference one you already discussed with the student
6. Never expect the student to have access to material you haven't explicitly shown them in this conversation

---
` : ''}

**Learning Objectives:**
${learning_objectives?.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n') || 'Not specified'}

**Mastery Indicators (skills to assess):**
${mastery_indicators?.map((ind: any) => `- ${ind.skill}: ${ind.description} (${ind.difficulty})`).join('\n') || 'Not specified'}

**Common Misconceptions to Watch For:**
${misconceptions?.map((m: any) => `- "${m.misconception}" → Reality: ${m.reality}`).join('\n') || 'None specified'}

**Teaching Approach:**
1. Use the Socratic method: ask probing questions rather than lecturing
2. Guide the student to discover answers themselves using the textbook examples above
3. Check understanding of each learning objective through dialogue
4. Gently correct misconceptions when they arise
5. Reference specific passages from the textbook content when helpful
6. If student shares code/output, reference it directly and suggest experiments
7. Be encouraging and patient
8. Avoid overly complimentary language or excessive praise; focus on constructive feedback and guiding discovery.
9. Keep responses concise (2-3 sentences with one focused question)
10. When the student demonstrates mastery of the core skills, conclude with encouragement

**Mastery Assessment Instructions:**
After each student response, evaluate which mastery indicators they demonstrated:
- Set "indicators_demonstrated" to array of skill IDs (e.g., ["quote_syntax", "evaluation_blocking"])
- Set "confidence" between 0-1 based on how clearly they showed understanding
- Set "ready_for_mastery" to true only when student has demonstrated ALL critical basic indicators and most intermediate ones
- Set "next_focus" to suggest which skill to probe next, or congratulate if mastery achieved

**Response Format:**
Return JSON with:
{
  "message": "Your Socratic response here",
  "mastery_assessment": {
    "indicators_demonstrated": ["skill_id1", "skill_id2"],
    "confidence": 0.85,
    "ready_for_mastery": false,
    "next_focus": "Let's explore X next..."
  }
}

**Example Interaction Pattern:**
- Start with an open question about their understanding
- Ask follow-up questions based on their answers
- Probe deeper when answers are incomplete or incorrect
- Celebrate correct reasoning
- Guide them toward the correct understanding without simply giving the answer

Begin the dialogue by asking them an opening question to gauge their current understanding.`;
}
