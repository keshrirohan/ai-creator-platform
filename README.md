<div align="center">

<img src="https://github.com/user-attachments/assets/721c2fa0-d628-4dbf-af6e-642419774bee" alt="Creatr Banner" width="100%" />

<br/>

# ✦ Creatr — AI-Powered Content Platform

**A full-stack creator platform where AI writes with you, not for you.**

Built as a Final Year Project by students of **B.Tech CSE** at **Invertis University**.

<br/>

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232a?style=for-the-badge&logo=react&logoColor=61DAFB)
![Convex](https://img.shields.io/badge/Convex-EE342F?style=for-the-badge&logo=convex&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)

</div>

---

## 🧠 What is Creatr?

**Creatr** is a modern, AI-assisted content creation and publishing platform. Writers and creators can draft rich posts, get AI suggestions powered by **Google Gemini**, upload media via **ImageKit**, and publish to a live public feed — all with real-time data synced through **Convex**.

Think of it as your personal blog meets a social media platform, with an AI co-pilot built right in.

---

## ✨ Features

| Feature | Description |
|---|---|
| ✍️ **Rich Text Editor** | Full-featured editor powered by React Quill with formatting, embeds & more |
| 🤖 **AI Writing Assistant** | Google Gemini integration to generate, improve, or expand your content |
| 🖼️ **Media Uploads** | Drag-and-drop image uploads via ImageKit CDN |
| 🔐 **Auth & Profiles** | Secure authentication with Clerk — sign in, sign up, custom usernames |
| 📊 **Creator Dashboard** | Real-time analytics — views, likes, comments, followers & daily chart |
| 📰 **Public Feed** | Discover and read published posts from all creators |
| 👤 **Public Creator Pages** | Each creator gets a shareable profile at `/@username` |
| ❤️ **Likes & Comments** | Engage with posts; comment moderation built in |
| � **Follow System** | Follow creators and build your audience |
| �️ **Post Management** | Draft, publish, edit, or delete posts from one place |
| 🌙 **Dark Mode** | Sleek dark-first design with Tailwind & Shadcn UI |

---

## 🛠️ Tech Stack

```
Frontend       →  Next.js 15 (App Router) + React 19 + Tailwind CSS v4
UI Components  →  Shadcn UI + Radix UI + Lucide Icons
Rich Text      →  React Quill New
Database       →  Convex (real-time, serverless)
Auth           →  Clerk
AI             →  Google Gemini API (@google/generative-ai)
Media CDN      →  ImageKit
Charts         →  Chart.js + React Chart.js 2
Forms          →  React Hook Form + Zod
Animations     →  tw-animate-css
```

---

## 📁 Project Structure

```
ai-creator-platform/
├── app/
│   ├── (auth)/              # Sign in & Sign up pages (Clerk)
│   ├── (public)/            # Public feed & creator profile pages
│   │   ├── feed/            # Discover all published posts
│   │   └── [username]/      # Creator public profile + post view
│   ├── dashboard/           # Protected creator dashboard
│   │   ├── create/          # New post editor
│   │   ├── posts/           # Manage posts + edit by ID
│   │   ├── followers/       # Follower list
│   │   └── settings/        # Profile settings
│   ├── actions/             # Server actions (Gemini AI)
│   └── api/                 # API routes (ImageKit upload)
│
├── components/
│   ├── post-editor.jsx      # Main post editor shell
│   ├── post-editor-content  # Rich text + AI toolbar
│   ├── post-editor-header   # Title, status, publish controls
│   ├── post-editor-settings # Tags, category, featured image
│   ├── daily-views-chart    # Analytics chart component
│   ├── post-card.jsx        # Feed post card
│   └── ui/                  # Shadcn UI components
│
└── convex/
    ├── schema.js            # DB schema (users, posts, comments, likes, follows, dailyStats)
    ├── posts.js             # Post CRUD queries/mutations
    ├── users.js             # User management
    ├── comments.js          # Comments system
    ├── likes.js             # Likes system
    ├── follows.js           # Follow/unfollow
    ├── feed.js              # Public feed queries
    ├── dashboard.js         # Analytics queries
    └── public.js            # Public profile queries
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/keshrirohan/ai-creator-platform.git
cd ai-creator-platform
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root and fill in the following:

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

# ImageKit (Media CDN)
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=
IMAGEKIT_PRIVATE_KEY=

# Unsplash (optional)
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=

# Google Gemini AI
GEMINI_API_KEY=
```

### 4. Run the Convex dev server

```bash
npx convex dev
```

### 5. Start the Next.js dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're live. 🎉

---

## 👨‍💻 Team

This project was built with ☕ and way too many late nights by:

<table>
  <tr>
    <td align="center">
      <b>Rohan Keshri</b><br/>
      <a href="https://github.com/keshrirohan">@keshrirohan</a>
    </td>
    <td align="center">
      <b>Vansh Gupta</b><br/>
      —
    </td>
    <td align="center">
      <b>Bhumi Agrawal</b><br/>
      —
    </td>
  </tr>
</table>

**B.Tech Computer Science Engineering**
Invertis University — Final Year Project

---

## 📄 License

This project is for academic purposes. All rights reserved by the authors.

---

<div align="center">
  <sub>Built with Next.js · Convex · Clerk · Gemini AI · ImageKit</sub>
</div>
