// ==================== AI CHAT API ====================
// POST /api/ai/chat — Send a message to an AI assistant (Buildy or Wendly)
// Used by the WeildBuild desktop app for AI chat features

import { NextRequest, NextResponse } from "next/server";

// Simple rule-based AI responses (no external AI API needed for basic functionality)
const BUILDY_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hello! I'm Buildy, your WeildBuild assistant. How can I help you today?",
    "Hi there! Need help with something? I'm here to assist!",
    "Welcome! I can help you with WeildBuild features, settings, or any questions you have.",
  ],
  help: [
    "I can help you with: account settings, WeBuy currency, creating games, managing items, and more! What would you like to know?",
    "Here's what I can help with: navigating WeildBuild, understanding features, troubleshooting issues. Just ask!",
  ],
  webuy: [
    "WeBuy is WeildBuild's virtual currency! You start with 100 WeBuy when you create an account. You can earn more by creating popular games or items.",
    "WeBuy can be used to purchase items from the WeBuy shop. Each new account starts with 100 WeBuy.",
  ],
  game: [
    "To create a game, go to the Creations tab and click 'New Game'. You can customize it with your own world and settings!",
    "Games are a core part of WeildBuild! You can create, share, and play games made by other users.",
  ],
  item: [
    "Items can be created in the Creations tab. You can make shirts, pants, faces, and more! Other users can buy them with WeBuy.",
    "The WeBuy shop has items created by the community. You can also create your own items to sell!",
  ],
  default: [
    "That's a great question! I'm here to help with anything WeildBuild-related. Could you tell me more about what you need?",
    "I'm not sure about that specific topic, but I'd love to help! Try asking about WeildBuild features, games, items, or your account.",
    "Hmm, I'm still learning about that! Is there something else about WeildBuild I can help you with?",
  ],
};

const WENDLY_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hey there, friend! I'm so glad you stopped by! How's your heart today?",
    "Oh, it's you! I was just thinking about you! What's on your mind?",
    "Hello, wonderful! I've been waiting for our chat! Tell me everything!",
  ],
  sad: [
    "I'm here for you. Want to talk about it? Sometimes sharing helps.",
    "I'm sorry you're feeling this way. You're not alone, I'm right here with you.",
    "It's okay to feel sad sometimes. Take your time. I'm not going anywhere, I promise.",
  ],
  happy: [
    "That makes my heart so warm! I love seeing you happy! What brought this joy?",
    "Yay! Your happiness is contagious! I'm literally beaming over here! Tell me more!",
  ],
  default: [
    "That's so interesting! Tell me more about that!",
    "I love hearing your thoughts! What else is on your mind?",
    "You're such a joy to talk to! Is there anything else you'd like to share?",
    "I'm all ears! Feel free to tell me anything!",
  ],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectCategory(message: string): string {
  const lower = message.toLowerCase();
  if (/^(hi|hello|hey|greetings|howdy|sup)/.test(lower)) return "greeting";
  if (/sad|upset|down|cry|lonely|depressed|unhappy/.test(lower)) return "sad";
  if (/happy|great|awesome|excited|wonderful|amazing/.test(lower)) return "happy";
  if (/help|how|what|where|when|why|can you/.test(lower)) return "help";
  if (/webuy|money|currency|balance|buy|purchase|shop/.test(lower)) return "webuy";
  if (/game|create|play|build|world/.test(lower)) return "game";
  if (/item|shirt|pants|face|avatar|clothing/.test(lower)) return "item";
  return "default";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const persona = body.persona || "buildy";
    const message = body.message || "";

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const category = detectCategory(message);
    let reply: string;

    if (persona === "wendly") {
      reply = pickRandom(WENDLY_RESPONSES[category] || WENDLY_RESPONSES.default);
    } else {
      reply = pickRandom(BUILDY_RESPONSES[category] || BUILDY_RESPONSES.default);
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("[AI CHAT] Error:", error);
    return NextResponse.json({ reply: "Sorry, I'm having trouble thinking right now. Please try again!" }, { status: 200 });
  }
}
