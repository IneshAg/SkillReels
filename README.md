# 🚀 TECHORA: The Attention-to-Action Learning Engine

TECHORA is a prototype platform designed to disrupt passive "doom-scrolling" by seamlessly weaving interactive learning challenges into a short-form video feed. It competes for fragile attention using a TikTok-style interface, but uses a dynamic, real-time recommendation engine to turn that attention into real-world career progress.

## 🌟 Key Features

### 1. Endless Algorithmic Feed (The Canvas)
*   **TikTok-Style Interface:** A sleek, mobile-first UI adapted elegantly for desktop via responsive media queries.
*   **Continuous Scrolling:** Content is dynamically appended to the feed, allowing users to scroll smoothly through their learning journey.
*   **Live Execution Sandboxes:** The biggest drop-off in learning apps is forcing users to leave the app to write code. TECHORA embeds **live React Component Builders** and **API Endpoint Builders** directly into the feed, allowing users to build stateful UI and logic natively on their phones.

### 2. Intelligent Recommendation Engine (The Brain)
*   **Goal Scoping & Serendipity (The 20% Rule):** The engine scopes the feed to the user's declared career goal (e.g., Frontend Developer). However, on every swipe, there is a **20% chance** the engine injects a serendipitous exploration topic (like Security or Cloud). 
*   **Organic Interest Blending:** If the user spends time engaging with an exploration topic, the engine detects the organic interest and permanently drops the curriculum walls, blending the new topic into their personalized feed.
*   **Intervention Logic (Stall Prevention):** If a user passively watches too many videos without taking action (high `passive_streak`), the engine actively intercepts the standard ranking algorithm to force an interactive challenge, breaking the dopamine loop.

### 3. "Under-the-Hood" System View
*   **Real-time Diagnostics:** A togglable diagnostic panel (System View) visualizes the engine's internal math and decision-making in real-time, proving the curriculum is a living graph, not a hardcoded playlist.
*   **Progress vs. Screen Time Metrics:** The app tracks real skill progression per minute, mathematically proving that a 3-minute interactive path beats 30 minutes of passive watching.
*   **Scenario Simulator:** Dedicated endpoints allow rapid testing of edge cases, including "Cold Starts", "Goal Divergence", and "Dopamine Loop Reversals".

### 4. Interactive Learning Modules
*   **Immersive Lessons:** Auto-playing, looping HTML5 video players with fully functional UI overlays (Play/Pause, custom Progress Bars, Mute, Save, and Options).
*   **Pop Quizzes:** Quick multiple-choice knowledge checks to convert passive exposure into conceptual evidence.
*   **Application Challenges:** Hands-on Parsons problems (drag-and-drop code assembly) and Live Code Fixes that verify true skill acquisition.

## 🏗️ Architecture & Tech Stack

**Backend (The Brain)**
*   **Framework:** FastAPI (Python)
*   **Database:** SQLite via SQLModel / SQLAlchemy (Event-sourcing ledger)
*   **Core Logic:** The recommendation algorithm (`engine.py`) intercepts user interaction events via `POST /events` and traverses an in-memory graph to return the highest-priority `ContentUnit`.

**Frontend (The Canvas)**
*   **Framework:** React 18 + Vite (TypeScript)
*   **Styling:** Custom CSS with robust desktop adaptation.
*   **State Management:** Complex React hook architectures managing real-time video playback, asynchronous queue pre-fetching, and dynamic state updates.

## 🚀 Getting Started

### 1. Start the Backend API
Navigate to the root directory and install dependencies:
```bash
pip install fastapi uvicorn sqlmodel
```
Run the backend server (this will automatically seed the `skillreels.db` SQLite database with the curriculum catalog):
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 2. Start the Frontend App
Open a second terminal, navigate to the `frontend` directory, and start the Vite development server:
```bash
cd frontend
npm install
npm run dev
```

### 3. Experience the App
1. Open `http://localhost:5173` in your browser.
2. Toggle the **Bug Icon (System View)** in the top right corner to watch the algorithm's brain in real-time.
3. Start interacting! Watch the videos, answer the quizzes, and observe how the backend Evidence Ladder fills up.
4. Try the **"Cold start"** button in the System View to wipe your database records and start fresh, observing how the engine routes you.
5. Go to the **Progress** tab and click **"Pitch Demo: Live Execution Environment"** to instantly test the embedded UI Sandbox.

## 🗂️ Curriculum Catalog
The seeded database (`backend/seed_data.py`) currently includes a rich path through:
*   **Frontend Development:** React hooks, State rendering, and UI building.
*   **REST APIs:** From foundational concepts to securing endpoints.
*   **Databases:** Relational DB basics and SQL JOINs.
*   **Authentication:** OAuth2 flows and JWT storage mechanics.
*   **DevOps:** Containers vs VMs and writing Dockerfiles.
