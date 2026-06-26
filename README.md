# 🖥️ Info PDV — Computer Store Management System

A complete point-of-sale (POS) and service order management system built for internal use at Infocentro, a computer store and tech repair shop.

> **Actively in development.**

---

## 📋 About

### The problem

Managing a computer store involves two distinct flows: product sales and service orders (SO) for repairs. Handling them separately or manually leads to rework and lost customer history.

### The solution

Info PDV unifies sales and service orders in a single system designed for small to medium computer stores.

---

## ✨ Features (planned and in development)

**POS — Sales**
- Product catalog with price and stock management
- Sales recording with receipt generation
- Inventory control with low-stock alerts
- Sales history by period

**Service Orders**
- Open SOs with customer and device data
- Reported problem description and diagnosis
- Status tracking (received → in analysis → waiting for parts → ready → delivered)
- Record of services performed and parts used
- SO generation for printing or sharing

**General**
- Customer registry with complete history
- Daily/monthly financial dashboard
- Per-user authenticated access

---

## 🛠️ Tech Stack

- **Framework:** React + Vite
- **Language:** JavaScript
- **Backend:** Node.js (custom API)
- **Styling:** CSS
- **Deployment:** Vercel

---

## 🚀 Running locally

```bash
git clone https://github.com/CoimbraJP/info-pdv.git
cd info-pdv
npm install
cp .env.example .env
# Fill in the required variables
npm run dev
```

Open `http://localhost:5173`

---

## 🌐 Live

[info-pdv.vercel.app](https://info-pdv.vercel.app)

---

## 👨‍💻 Author

**João Paulo Coimbra**
[![LinkedIn](https://img.shields.io/badge/LinkedIn-coimbrajp-0A66C2?style=flat&logo=linkedin)](https://www.linkedin.com/in/coimbrajp/)
[![GitHub](https://img.shields.io/badge/GitHub-CoimbraJP-181717?style=flat&logo=github)](https://github.com/CoimbraJP)
