# ✦ Creatr — AI-Powered Content Platform

**A full-stack content creation and publishing platform with an integrated AI writing assistant.**

Developed as a Final Year Project by B.Tech Computer Science and Engineering students at **Invertis University**.

---

## 🧠 About Creatr

**Creatr** is an AI-powered content creation and publishing platform designed to help writers and creators create, manage, and share content efficiently.

The platform integrates Google's Gemini AI to assist users with writing, improving, and expanding their content. It also provides rich text editing, media uploads, creator profiles, real-time analytics, and social engagement features.

Built using modern web technologies, Creatr combines the functionality of a blogging platform with the experience of a creator-focused social network.

---

## ✨ Features

| Feature | Description |
|---|---|
| ✍️ Rich Text Editor | Create and format content with a feature-rich editor. |
| 🤖 AI Writing Assistant | Generate, improve, and expand content using Google Gemini AI. |
| 🖼️ Media Uploads | Upload and manage images using ImageKit CDN. |
| 🔐 Authentication | Secure sign-up, sign-in, and user profiles using Clerk. |
| 📊 Creator Dashboard | Track views, likes, comments, followers, and daily analytics. |
| 📰 Public Feed | Explore and discover content published by creators. |
| 👤 Creator Profiles | Dedicated public profiles with shareable usernames. |
| ❤️ Likes & Comments | Interact with published posts. |
| 🤝 Follow System | Follow creators and build a community. |
| 📝 Post Management | Create, edit, publish, and delete posts. |
| 🌙 Dark Mode | Modern interface with dark theme support. |

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js 15, React 19 |
| Styling | Tailwind CSS v4 |
| UI Components | Shadcn UI, Radix UI, Lucide Icons |
| Rich Text Editor | React Quill New |
| Database | Convex |
| Authentication | Clerk |
| AI Integration | Google Gemini API |
| Media Storage | ImageKit |
| Charts | Chart.js, React Chart.js 2 |
| Forms & Validation | React Hook Form, Zod |

---

## 📁 Project Structure

```text
ai-creator-platform/
├── app/
│   ├── (auth)/
│   ├── (public)/
│   │   ├── feed/
│   │   └── [username]/
│   ├── dashboard/
│   │   ├── create/
│   │   ├── posts/
│   │   ├── followers/
│   │   └── settings/
│   ├── actions/
│   └── api/
│
├── components/
│   ├── post-editor.jsx
│   ├── post-editor-content
│   ├── post-editor-header
│   ├── post-editor-settings
│   ├── daily-views-chart
│   ├── post-card.jsx
│   └── ui/
│
└── convex/
    ├── schema.js
    ├── posts.js
    ├── users.js
    ├── comments.js
    ├── likes.js
    ├── follows.js
    ├── feed.js
    ├── dashboard.js
    └── public.js
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm
- Convex account
- Clerk account
- Google Gemini API key
- ImageKit account

### 1. Clone the Repository

```bash
git clone YOUR_GROUP_REPOSITORY_URL
cd ai-creator-platform
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root directory.

```env
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_JWT_ISSUER_DOMAIN=

# ImageKit
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=
IMAGEKIT_PRIVATE_KEY=

# Unsplash (Optional)
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=

# Google Gemini AI
GEMINI_API_KEY=
```

### 4. Start Convex

```bash
npx convex dev
```

### 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👨‍💻 Project Team

Developed by the following students as part of their Final Year Project.

| Team Member | Role |
|---|---|
| Vansh Gupta | |
| Rohan Keshri | |
| Bhumi Agrawal | |

**Department:** Computer Science and Engineering  
**University:** Invertis University  
**Project Type:** Final Year Group Project

---

## 🎯 Project Objective

The primary objective of Creatr is to simplify digital content creation by combining AI-powered writing assistance with a collaborative creator ecosystem.

The platform aims to provide an accessible environment where users can create, publish, discover, and interact with digital content.

---

## 📄 License

This project is maintained for academic and educational purposes. Third-party libraries, frameworks, and reused components remain subject to their respective licenses and applicable attribution requirements.

---

<div align="center">

**Creatr — Create. Express. Publish.**

Built with Next.js · Convex · Clerk · Gemini AI · ImageKit

**B.Tech Computer Science and Engineering**  
Invertis University

</div>
