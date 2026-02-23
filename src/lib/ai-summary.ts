/**
 * AI Summary generator using Google Gemini 2.0 Flash Lite (cheapest model).
 * Generates a 2-3 sentence daily summary of a student's study activity for parents.
 */

interface StudySessionData {
    className: string;
    durationMinutes: number;
    notes?: string;
}

interface DailySummaryInput {
    studentName: string;
    totalStudyMinutes: number;
    sessions: StudySessionData[];
    giftsReceived: number;
}

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export async function generateDailySummary(input: DailySummaryInput): Promise<string> {
    if (!GEMINI_API_KEY) {
        return 'AI summaries are not configured. Add NEXT_PUBLIC_GEMINI_API_KEY to your environment.';
    }

    if (input.sessions.length === 0) {
        return `${input.studentName} hasn't studied yet today. Check back later!`;
    }

    // Build a concise data description for the AI
    const classBreakdown = input.sessions
        .reduce((acc, s) => {
            const existing = acc.find(a => a.className === s.className);
            if (existing) {
                existing.minutes += s.durationMinutes;
                if (s.notes) existing.notes.push(s.notes);
            } else {
                acc.push({ className: s.className, minutes: s.durationMinutes, notes: s.notes ? [s.notes] : [] });
            }
            return acc;
        }, [] as { className: string; minutes: number; notes: string[] }[])
        .map(c => `${c.className}: ${c.minutes}m${c.notes.length > 0 ? ` (notes: "${c.notes.join('", "')}")` : ''}`)
        .join(', ');

    const prompt = `You are a warm, encouraging assistant for parents monitoring their child's daily study progress. Given the following data, write a brief 2-3 sentence summary. Be positive and specific. Don't use emojis. Keep it under 60 words.

Student: ${input.studentName}
Today's study time: ${input.totalStudyMinutes} minutes across ${input.sessions.length} session(s)
Classes: ${classBreakdown}
Rewards received today: ${input.giftsReceived}`;

    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 100,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            console.error('[AI Summary] API error:', response.status, await response.text());
            return 'Unable to generate summary right now. Try again later.';
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text?.trim() || 'No summary available.';
    } catch (error) {
        console.error('[AI Summary] Error:', error);
        return 'Unable to generate summary right now. Try again later.';
    }
}
