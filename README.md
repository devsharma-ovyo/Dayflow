# DayFlow  — Personal Task & Habit Manager

> A macOS-styled personal task management and recurring habit tracking Progressive Web App (PWA) built with React 19, TypeScript, and Tailwind CSS. Features automated recurring schedule resets, active day filters, streak consistency metrics, time-based reminders, and offline persistence with JSON backup/restore.

---

## ✨ Features

- **Custom Recurrence Engine**:
  - **Recurring Tasks**: Multi-select active days of the week (Mon–Sun). Tasks only show up in today's active view on scheduled days.
  - **Streak Tracker**: Maintains streaks across off-days according to the scheduled active days.
  - **Weekly Focus**: Resets every Monday at midnight with an optional one-off *"Skip this week"* toggle.
  - **One-Time Tasks**: High, Medium, and Low priority sorting with completion archiving.
- **Smart Sorting & Flow**:
  - Completed items automatically slide to the bottom of their priority group.
  - Drag-and-drop manual reordering within priority tiers.
- **Time-Based Reminders & Audio**:
  - Scheduled browser notifications and gentle audio chimes when due.
- **Visual Consistency & Streaks**:
  - 14-day habit matrix visualizing active days, completions, and off-days.
  - Celebratory micro-interactions on priority accomplishments.
- **Data Portability & Offline-First**:
  - Offline PWA support with Service Worker.
  - One-click JSON backup export & restore to easily move data across machines and browsers.
- **macOS Window Interface**:
  - Native dark/light mode toggle, collapsible views, and keyboard shortcuts (`⌘N` for new task, `⌘F` for search, `Esc` to close modals).

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18+ recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/) / [pnpm](https://pnpm.io/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/dayflow.git
   cd dayflow
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `⌘ + N` / `Ctrl + N` | Create a new task |
| `⌘ + F` / `Ctrl + F` | Focus search bar |
| `Esc` | Close any active modal |

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Audio & FX**: Web Audio API Synthesizer & Canvas Confetti
- **Build Tool**: Vite

---

## 📄 License

MIT
