# السكرتير الذكي (The Smart Secretary) - Design Document

## App Overview

An intelligent AI-powered secretary mobile app that provides conversational AI assistance, task automation through agents, web search capabilities, and coding assistance. The app follows Apple Human Interface Guidelines for a native iOS feel.

---

## Screen List

### 1. Home Screen (Chat)
The primary interface for AI conversations.

### 2. Agents Screen
Multi-step task automation with predefined agent workflows.

### 3. Search Screen
Web search functionality with AI-enhanced results.

### 4. Code Screen
Coding assistant for code generation, review, and explanation.

### 5. Settings Screen
App preferences, theme toggle, and conversation history management.

---

## Primary Content and Functionality

### Home Screen (Chat)
- **Header**: App title "السكرتير الذكي" with settings icon
- **Chat Area**: Scrollable message list with:
  - User messages (right-aligned, primary color bubble)
  - AI responses (left-aligned, surface color bubble)
  - Typing indicator during AI response generation
  - Timestamps for messages
- **Input Area**: 
  - Text input field with placeholder "اكتب رسالتك..."
  - Send button with haptic feedback
  - Voice input button (optional)
- **Quick Actions**: Horizontal scroll of suggestion chips

### Agents Screen
- **Header**: "الوكلاء" (Agents) title
- **Agent Cards Grid**: 2-column layout with agent options:
  - 📧 Email Assistant - Draft and manage emails
  - 📅 Calendar Manager - Schedule and organize events
  - 📝 Note Taker - Create and organize notes
  - 🔍 Research Agent - Deep research on topics
  - 📊 Data Analyzer - Analyze and visualize data
  - 🤖 Custom Agent - Create custom workflows
- **Active Tasks Section**: List of running agent tasks with progress

### Search Screen
- **Search Bar**: Prominent search input at top
- **Search Results**: Card-based results with:
  - Title and snippet
  - Source URL
  - AI summary toggle
- **Search History**: Recent searches below input
- **Filters**: Web, Images, News tabs

### Code Screen
- **Mode Selector**: Tabs for Generate, Review, Explain
- **Code Input**: Multi-line text area with syntax highlighting
- **Language Selector**: Dropdown for programming language
- **Output Area**: Generated/reviewed code with copy button
- **Quick Templates**: Common code patterns

### Settings Screen
- **Profile Section**: User avatar and name (if authenticated)
- **Appearance**: 
  - Theme toggle (Light/Dark/System)
  - Language selector (Arabic/English)
- **AI Settings**:
  - Response style (Concise/Detailed)
  - Enable/disable features
- **Data Management**:
  - Clear chat history
  - Export conversations
- **About**: App version and credits

---

## Key User Flows

### Flow 1: AI Chat Conversation
1. User opens app → Home (Chat) screen displays
2. User types message in input field
3. User taps send button → Haptic feedback
4. Message appears in chat → Typing indicator shows
5. AI response streams in → Typing indicator hides
6. User can continue conversation or start new topic

### Flow 2: Using an Agent
1. User taps Agents tab → Agents screen displays
2. User selects agent card (e.g., Email Assistant)
3. Agent detail sheet slides up with:
   - Agent description
   - Required inputs
   - Start button
4. User fills inputs → Taps Start
5. Agent runs → Progress shown in Active Tasks
6. Agent completes → Result notification
7. User taps result → Detailed output view

### Flow 3: Web Search with AI Summary
1. User taps Search tab → Search screen displays
2. User enters search query
3. User taps search → Loading indicator
4. Results appear as cards
5. User taps "AI Summary" on a result
6. AI generates summary → Displays in expandable section

### Flow 4: Code Generation
1. User taps Code tab → Code screen displays
2. User selects "Generate" mode
3. User describes what code they need
4. User selects programming language
5. User taps Generate → Loading indicator
6. Generated code appears with syntax highlighting
7. User taps Copy → Code copied with haptic feedback

---

## Color Choices

### Primary Palette
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `primary` | #2563EB (Royal Blue) | #3B82F6 | Accent, buttons, links |
| `background` | #FFFFFF | #0F172A | Screen backgrounds |
| `surface` | #F1F5F9 | #1E293B | Cards, message bubbles |
| `foreground` | #0F172A | #F8FAFC | Primary text |
| `muted` | #64748B | #94A3B8 | Secondary text |
| `border` | #E2E8F0 | #334155 | Dividers, borders |

### Semantic Colors
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `success` | #10B981 | #34D399 | Success states |
| `warning` | #F59E0B | #FBBF24 | Warning states |
| `error` | #EF4444 | #F87171 | Error states |
| `user-bubble` | #2563EB | #3B82F6 | User message background |
| `ai-bubble` | #F1F5F9 | #1E293B | AI message background |

---

## Typography

- **Arabic Font**: System default (SF Arabic on iOS)
- **Title**: 28px Bold
- **Subtitle**: 20px Semibold
- **Body**: 16px Regular
- **Caption**: 14px Regular
- **Code**: 14px Monospace (for code blocks)

---

## Navigation Structure

```
Tab Bar (Bottom)
├── Home (Chat) - house.fill icon
├── Agents - person.3.fill icon
├── Search - magnifyingglass icon
├── Code - chevron.left.forwardslash.chevron.right icon
└── Settings - gearshape.fill icon
```

---

## Component Specifications

### Message Bubble
- Border radius: 16px
- Padding: 12px 16px
- Max width: 80% of screen
- User bubbles: Right-aligned, primary background
- AI bubbles: Left-aligned, surface background

### Agent Card
- Size: (screen width - 48px) / 2
- Border radius: 16px
- Padding: 16px
- Icon size: 32px
- Shadow: subtle elevation

### Input Field
- Height: 48px
- Border radius: 24px
- Background: surface
- Placeholder: muted color

### Action Button
- Height: 48px
- Border radius: 24px
- Background: primary
- Text: background color (white)

---

## Interaction Patterns

### Press Feedback
- Primary buttons: Scale 0.97 + Light haptic
- Cards: Opacity 0.7
- Icons: Opacity 0.6

### Loading States
- Chat: Typing indicator (animated dots)
- Search/Code: Skeleton loading
- Agents: Progress bar with percentage

### Animations
- Screen transitions: 300ms ease
- Message appear: Fade in + slide up 200ms
- Button press: Scale 80ms

---

## RTL Support

The app supports Right-to-Left (RTL) layout for Arabic:
- Text alignment: Right for Arabic content
- Navigation: RTL-aware
- Icons: Mirrored where appropriate
