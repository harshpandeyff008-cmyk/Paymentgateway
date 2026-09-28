/**
 * Gemini AI Smart Chat Service for Seller Support Desk
 * Uses Gemini API to generate professional deal-closing, escrow, and action replies.
 */

const GEMINI_API_KEY = "AIzaSyDMUsX4DrRIMUFKMsvv4VGf4jqSj6oKyG4";

export async function generateSmartSellerReplies({ clientName, clientEmail, messages = [], sellerDraft = '', stylePrompt = '' }) {
  // Format message history
  const recentHistory = messages.slice(-10).map(m => `${m.senderName || 'User'}: ${m.text || ''}`).join('\n');

  const badge1 = sellerDraft ? "🤝 Professional Hinglish" : "🤝 Deal Closer";
  const badge2 = sellerDraft ? "⚡ Professional English" : "⚡ Quick Action";
  const badge3 = sellerDraft ? "🛡️ Short & Direct" : "🛡️ Escrow Policy";

  const tone1 = sellerDraft ? "Professional Hinglish" : "Deal Closer & Reassuring";
  const tone2 = sellerDraft ? "Professional English" : "Direct Action & Steps";
  const tone3 = sellerDraft ? "Short & Direct" : "Escrow & Security Policy";

  let optionInstructions = `
Generate 3 distinct, high-impact seller reply options:
Option 1: "Deal Closer & Reassuring" (Polite, trust-building, escrow verified, resolving customer doubts, calming anxiety, closing sales)
Option 2: "Direct Action & Step Instructions" (Quick, clear, guidance for login, OTP, credentials check, or payment confirmation)
Option 3: "Escrow, Cooldown & Security Policy" (Firm yet polite explanation of security rules, 48h mail cooldown, manual handover warranty)
`;

  if (sellerDraft) {
    optionInstructions = `
CRITICAL INSTRUCTION: Since the seller has provided a rough thought/draft: "${sellerDraft}", your primary task is to TRANSLATE, POLISH, and ENHANCE this draft. Do NOT generate generic or unrelated replies.
Generate 3 distinct, high-impact polished versions of this draft:
Option 1: "Professional Hinglish" (Polite, professional, grammatical Hinglish rephrasing of the seller's draft, easy to understand)
Option 2: "Professional English" (Ultra-professional, clean, grammatically perfect English translation and expansion of the seller's draft)
Option 3: "Short & Direct (Hinglish/English)" (Direct, simple, to-the-point rephrasing of the seller's draft, keeping it concise)
`;
  }

  const promptText = `You are an elite, highly professional AI Copilot for a top-tier Free Fire Gaming Account Seller & Escrow Support Desk (Seller / Deals Portal).
Your job is to analyze the customer's chat and generate 3 sharp, polite, professional, and deal-closing reply options in natural Hinglish (or English if customer chats in English).

Customer Info:
- Customer Name: ${clientName || 'Customer'}
- Email: ${clientEmail || 'N/A'}
${sellerDraft ? `- Seller's rough thought/draft: "${sellerDraft}" (Enhance/polish this into professional replies)` : ''}
${stylePrompt ? `- Special Focus Mode: "${stylePrompt}"` : ''}

Recent Conversation History:
${recentHistory || 'Customer just joined support chat.'}

${optionInstructions}

Return strictly a JSON array containing 3 objects with keys "tone", "badge", and "reply":
[
  {
    "tone": "${tone1}",
    "badge": "${badge1}",
    "reply": "..."
  },
  {
    "tone": "${tone2}",
    "badge": "${badge2}",
    "reply": "..."
  },
  {
    "tone": "${tone3}",
    "badge": "${badge3}",
    "reply": "..."
  }
]
Do NOT write markdown code blocks or any explanation outside the valid JSON array.`;

  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        console.warn(`Model ${model} returned error ${response.status}. Trying next model...`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Clean JSON string (strip markdown code fences if model returned them)
      const cleanJson = rawText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
      
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Error with ${model}:`, err);
    }
  }

  // Fallback smart defaults if network is offline
  return [
    {
      tone: tone1,
      badge: badge1,
      reply: sellerDraft 
        ? `Hello ${clientName || 'Brother'}, regarding your request: "${sellerDraft}". Let's get this resolved securely.`
        : `Hello ${clientName || 'Brother'}, your account details & video proofs are 100% verified. Seller guarantees secure manual escrow handover.`
    },
    {
      tone: tone2,
      badge: badge2,
      reply: sellerDraft
        ? `Hi ${clientName || 'Brother'}, please refer to: "${sellerDraft}" for details. Kindly wait.`
        : `Got your request! Please check your credentials now and share the confirmation OTP so we can complete your secure account binding.`
    },
    {
      tone: tone3,
      badge: badge3,
      reply: sellerDraft
        ? `Regarding "${sellerDraft}", kindly coordinate.`
        : `As per our Escrow Protocol, all transactions are monitored manually to prevent any fraud or credential leaks. Your balance and asset are 100% safe.`
    }
  ];
}