# السكرتير الذكي (The Smart Secretary)

<div align="center">

![App Icon](assets/images/icon.png)

**مساعد ذكي شخصي مدعوم بالذكاء الاصطناعي**

An AI-powered personal assistant mobile app built with React Native and Expo

[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📱 Features

### 💬 AI Chat (الدردشة الذكية)
- Real-time AI conversations powered by Google Gemini
- Arabic language support with RTL layout
- Chat history persistence
- Quick action suggestions

### 🤖 Agents (الوكلاء)
Six specialized AI agents for task automation:
- **📧 Email Assistant** - Draft professional emails
- **📅 Calendar Manager** - Schedule and organize events
- **📝 Note Taker** - Create and organize notes
- **🔍 Research Agent** - Deep research on any topic
- **📊 Data Analyzer** - Analyze and visualize data
- **✨ Custom Agent** - Create custom workflows

### 🔍 Smart Search (البحث الذكي)
- Web search functionality
- AI-generated summaries for search results
- Search history management

### 💻 Code Assistant (مساعد الكود)
- **Generate**: Create code from natural language descriptions
- **Review**: Get code review and improvement suggestions
- **Explain**: Understand code with detailed explanations
- Support for 14+ programming languages

### ⚙️ Settings (الإعدادات)
- Haptic feedback toggle
- Response style preferences
- Chat history management
- Theme support (Light/Dark)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Expo CLI
- iOS Simulator / Android Emulator / Physical device with Expo Go

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/smart-secretary.git
cd smart-secretary
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Add your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

4. **Start the development server**
```bash
pnpm dev
```

5. **Run on device**
- Scan the QR code with Expo Go (Android)
- Scan the QR code with Camera app (iOS)

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React Native 0.81 | Cross-platform mobile framework |
| Expo SDK 54 | Development platform |
| TypeScript 5.9 | Type-safe JavaScript |
| NativeWind 4 | Tailwind CSS for React Native |
| Expo Router 6 | File-based routing |
| Google Gemini | AI/LLM backend |
| AsyncStorage | Local data persistence |
| React Native Reanimated | Smooth animations |

---

## 📁 Project Structure

```
smart-secretary/
├── app/                    # App screens (Expo Router)
│   ├── (tabs)/            # Tab-based navigation
│   │   ├── index.tsx      # Chat screen
│   │   ├── agents.tsx     # Agents screen
│   │   ├── search.tsx     # Search screen
│   │   ├── code.tsx       # Code assistant
│   │   └── settings.tsx   # Settings screen
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── ui/               # UI primitives
│   ├── message-bubble.tsx
│   ├── chat-input.tsx
│   └── agent-card.tsx
├── lib/                   # Core utilities
│   ├── ai-service.ts     # Gemini API integration
│   ├── chat-context.tsx  # Chat state management
│   ├── agents-data.ts    # Agent definitions
│   └── types.ts          # TypeScript types
├── hooks/                 # Custom React hooks
├── assets/               # Images and fonts
└── server/               # Backend API (optional)
```

---

## 🧪 Testing

Run the test suite:
```bash
pnpm test
```

The project includes unit tests for:
- AI service functions
- Type definitions
- Agent data and utilities

---

## 🌐 API Integration

### Google Gemini

The app uses Google Gemini 2.0 Flash for AI capabilities. To get an API key:

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Add it to your `.env` file

---

## 🎨 Design System

### Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary | #2563EB | #3B82F6 | Accent color |
| Background | #FFFFFF | #0F172A | Screen background |
| Surface | #F1F5F9 | #1E293B | Cards, bubbles |
| Foreground | #0F172A | #F8FAFC | Primary text |

### Typography

- Arabic: System default (SF Arabic on iOS)
- Code: Menlo / Monospace

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 Contact

For questions or support, please open an issue on GitHub.

---

<div align="center">

**Made with ❤️ for Arabic speakers**

</div>
