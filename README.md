# DataDrip — Premium Google Maps Scraper

![DataDrip Logo](Logo.png)

**DataDrip** is a powerful, modern Chrome extension that extracts business data directly from Google Maps search results instantly. Featuring a sleek glassmorphism UI and lightning-fast extraction logic.

---

## ✨ Features

- ⚡ **Rapid Extraction** — Works by scraping sidebar cards as it scrolls, extracting 20+ results per second
- 🎯 **Extraction Limit** — Set a custom limit to stop automatically (e.g., first 20 results)
- ⚙️ **Column Selection** — Toggle exactly which data fields you want in your CSV via the Settings panel
- 📋 **Rich Data Fields** — Captures Name, Address, Phone, Website, Categories, Rating, Review Count, Lat/Lng, Place ID, and more
- 📥 **One-Click CSV Export** — Clean, formatted CSV ready to open in Excel or Google Sheets
- ⏸️ **Pause & Resume** — Pause at any time and continue later without losing progress
- 🔄 **Reset Support** — Run new searches from scratch with a single button
- 🖱️ **Draggable Overlay** — Move the control panel anywhere on the page

---

## 📦 Exported CSV Columns

| Column | Description |
|---|---|
| Name | Business name |
| Fulladdress | Full street address |
| Street | Street portion of the address |
| Municipality | City / region |
| Categories | Business category |
| Phone | Primary phone number |
| Website | Business website URL |
| Domain | Domain name extracted from website |
| Average Rating | Google star rating |
| Review Count | Total number of reviews |
| Google Maps URL | Direct link to the listing |
| Latitude | GPS latitude |
| Longitude | GPS longitude |
| Place Id | Google Maps Place ID |
| Fid | Feature ID |
| Cid | Customer ID (numeric) |
| Review URL | Direct link to Google reviews |
| Featured Image | Thumbnail image URL |
| Opening Hours | Weekly hours formatted |
| Time Zone | Scraper device time zone |

---

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer Mode** (top right toggle)
4. Click **Load unpacked**
5. Select the folder containing this project

The **DataDrip** icon will appear in your extension toolbar.

---

## 🗺️ How to Use

1. Go to [Google Maps](https://www.google.com/maps) and search for any business category (e.g., `"used cars in Bengaluru"`)
2. Wait for the results list to load in the left sidebar
3. Click the **DataDrip** overlay's **Start** button
4. The scraper will automatically scroll through all results and extract data in seconds
5. Click **Download CSV** to save the file

---

## 📁 Project Structure

```
DataDrip/
├── manifest.json       # Chrome Extension Manifest v3
├── content.js          # Main overlay + rapid card scraping logic
├── injected.js         # XHR/Fetch interceptor (injected into page context)
├── popup.html          # Extension popup HTML
├── popup.js            # Extension popup JS
├── style.css           # Overlay styles
└── Logo.png            # Extension icon
```

---

## ⚙️ How It Works

Unlike traditional scrapers that click each result and wait for a detail page to load, DataDrip uses a **rapid DOM scraping** approach:

1. The overlay is injected directly into the Google Maps page
2. When you click **Start**, the script immediately reads all visible sidebar cards
3. It rapidly scrolls the results pane, reading each batch of cards as they appear
4. Data (name, rating, phone, address, coordinates, etc.) is parsed directly from the card DOM
5. Identifiers like Lat/Lng and Place ID are extracted from the listing URLs
6. All data is stored in memory and available for instant CSV download

This approach is **10–50x faster** than click-based scrapers.

---

## 🔒 Permissions Used

| Permission | Reason |
|---|---|
| `activeTab` | Access the current Google Maps tab |
| `scripting` | Inject the overlay into the page |
| `downloads` | Save the CSV file to disk |

No data is ever sent to any server. Everything stays local in your browser.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙋 Support

For issues or feature requests, open an issue at [github.com/zubair78600/DataDrip](https://github.com/zubair78600/DataDrip).
