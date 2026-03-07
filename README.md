# SkinClub Price Checker

A Chrome extension that displays near-real time of CSFloat market prices on Skin.Club.

## Installation

1. **Download** this repository (Code → Download ZIP) and extract it
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the extracted folder (the one containing `manifest.json`)
6. Done! Visit [skin.club/en/exchange](https://skin.club/en/exchange) to see prices

## Files Needed for Extension

Only these files are required for the extension to work:
- `manifest.json`
- `content.js`
- `styles.css`
- `icon16.png`
- `icon48.png`
- `icon128.png`

The `backend/` folder is **not needed** - the backend is already hosted online.

---

## For Developers

<details>
<summary>Backend Setup (Optional - only if self-hosting)</summary>

### Prerequisites
- Node.js
- MongoDB Atlas account

### Setup

```bash
cd backend
npm install
```

Create a `.env` file:
```
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

### Run

```bash
npm start
```

Update `BACKEND_URL` in `content.js` to point to your server.

</details>
