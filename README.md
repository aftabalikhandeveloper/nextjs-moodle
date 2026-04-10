# 🎓 Next.js Moodle AI Auto-Solver

A premium, automated solution for solving Moodle quizzes using Google Gemini 2.0 Flash AI. This tool features a Node.js backend scheduler for real-time auto-solving, a sleek modern dashboard, and secure JWT authentication.

---

## 🔥 Key Features

- **🤖 AI-Powered Solving:** Uses Gemini 2.0 Flash (Function Calling) for 10/10 accuracy scores.
- **🕒 Backend Scheduler:** Set and forget. Quizzes are solved automatically the moment they open.
- **📊 Real-time Grouped Logs:** Detailed question-by-question lifecycle logs showing AI reasoning and Choice IDs.
- **📜 Solve History:** Persistent local storage for 7 days with detailed result review and manual deletion.
- **🔐 Secure Access:** JWT-protected dashboard with `.env` based credentials.
- **🎨 Dark Premium UI:** Beautifully crafted dashboard with live status tracking.

---

## 🛠️ Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [Google AI Studio API Key](https://aistudio.google.com/)
- Moodle WebService Token (enabled for `mod_quiz` functions)

### 2. Installation
1. Clone your project:
   ```bash
   git clone aftabalikhandeveloper/nextjs-moodle
   cd nextjs-moodle
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### 3. Configuration (`.env`)
Create a `.env` file in the root directory and add the following:
```env
# Moodle
MOODLE_URL="https://your-moodle.com"
MOODLE_TOKEN="your_moodle_token"

# Google Gemini
GEMINI_API_KEY="your_api_key_here"

# Auth Settings
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your_secure_password"
JWT_SECRET="a_random_32_character_string"
```

### 4. Running Locally
```bash
npm run dev
```
Visit `http://localhost:3000` and sign in.

---

## 🚀 Deployment to Vercel

1. **Connect Repository:** Link your private GitHub/GitLab repo to Vercel.
2. **Environment Variables:** In Vercel Project Settings, add all `.env` variables listed above.
3. **Deploy:** Click deploy.

> **💡 Note for Experts:**
> Vercel has serverless function timeouts. For background scheduled tasks, this project is optimized for shorter gaps. For full-day background timers, consider a long-running Node server (DigitalOcean/Railway).

---

## 📖 How to Use (Normal User)

1. **Connect to Moodle:** Once configured, your dashboard will automatically list your current subjects and quizzes.
2. **Dashboard Overview:**
   - **Upcoming:** Quizzes that haven't opened yet.
   - **Current:** Quizzes ready to be solved.
   - **Past:** Closed quizzes.
3. **Schedule Auto-Solver:** Click the "Server Auto-Solver" toggle on any *Upcoming* quiz. You can now close your browser—the server will handle the rest.
4. **Manual Solve:** Click "Solve with AI Now" for active quizzes. Watch the real-time logs solve the quiz in front of you.
5. **Review History:** Click "View Solve Results" to see exactly what the AI selected and why.

---

## 📜 Legal Notice
This project is for research and educational purposes only. Always comply with your school's Academic Integrity guidelines.
