# CampusKart 🎓🛒

CampusKart is a peer-to-peer campus marketplace designed for university students to buy, sell, and trade essentials easily, safely, and effortlessly.

Built with the **MERN Stack** (MongoDB, Express, React, Node.js) and real-time messaging powered by **Socket.IO**.

---

## 🚀 Key Features

- **University Authentication**: Secure signup restricted to official campus emails (`@thapar.edu`) with JWT and bcrypt password hashing.
- **Marketplace & Filters**: Browse listings with real-time text search, category filtering, condition selection, and sorting.
- **Multi-Buyer Negotiation & Real-Time Chat**:
  - Multiple interested buyers can negotiate with a seller simultaneously.
  - Isolated real-time messaging rooms using Socket.IO.
  - Atomic sale confirmation ensuring exactly one buyer can complete a purchase.
  - Ability for buyers or sellers to end negotiations gracefully.
- **Two-Sided Reputation & Ratings System**:
  - Independent **Seller Reputation** and **Buyer Reputation** metrics.
  - Displays collective metrics (average star rating, review count, completed transactions count).
  - Multi-criterion evaluation (communication, punctuality, respectfulness, item condition, etc.).
- **Hostel Mode**:
  - Prioritizes listings from the student's own hostel.
  - Smooth Night Mode dark theme toggle.
- **Profile & Listing Management**:
  - Edit student profile (name & hostel) with automatic synchronization of available listings.
  - Segmented listings tabs: **Available Listings** and **Sold Listings**.
  - Soft-delete with automatic negotiation cancellation and buyer notification.
- **Custom Branding**: Modern split-screen authentication UI and custom campus favicon & browser tab branding.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, React Router v7, Axios, Socket.IO Client
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), Socket.IO, Multer, JWT, Bcrypt
- **Styling**: Vanilla CSS with modern responsive design and light/dark theme support

---

## 📦 Project Structure

```text
marketplace/
├── backend/
│   ├── controllers/      # Route logic & controllers
│   ├── middleware/       # Auth & file upload middleware
│   ├── models/           # Mongoose schemas (User, Listing, PurchaseRequest, etc.)
│   ├── routes/           # Express API endpoints
│   ├── socket/           # Socket.IO real-time chat handlers
│   ├── uploads/          # User product image uploads
│   ├── server.js         # Backend server entry point
│   └── package.json
├── frontend/
│   ├── public/           # Static assets, logos & favicons
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # AuthContext & HostelModeContext
│   │   ├── pages/        # Views (Marketplace, Profile, Login, Chat, etc.)
│   │   ├── App.jsx       # App routing
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── .gitignore
└── README.md
```

---

## ⚡ Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### 1. Clone the repository

```bash
git clone https://github.com/shresht-on-git/campusKart.git
cd campusKart
```

### 2. Backend Setup

```bash
cd backend
npm install
node server.js
```

Backend will run on `http://localhost:5000`.

### 3. Frontend Setup

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`.

---

## 📄 License

This project is licensed under the MIT License.
