# OEE Machine Dashboard

A real-time machine state dashboard that reads PackML state events from a Notion database and visualises them in a browser. Designed for use with a Siemens S7-1500 PLC that pushes state changes directly to the Notion REST API.

---

## What it does

- Shows the **current PackML state** per machine as a colour-coded card
- Displays a **state timeline** (Gantt-style) per machine over a selectable time window
- Lists the full **event history** in a sortable table with PackML state names
- Tracks **statistics** per time window: Execute events, Held events, Suspended events, Aborted events
- Supports **multi-machine filtering** — a machine selector appears automatically when more than one machine is present
- **Auto-refreshes** at a configurable interval (30 s, 60 s, 5 min)

---

## Architecture

```
S7-1500 PLC
    │
    │  HTTP POST  (on every state change)
    ▼
Notion REST API  ──►  Notion Database
                              │
                              │  HTTP POST (query)
                              ▼
                      Node.js proxy server  (server.js)
                              │
                              │  serves
                              ▼
                        Browser  (index.html)
```

The proxy server is needed because browsers block direct calls to `api.notion.com` due to CORS restrictions.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Notion account with an internal integration
- A Siemens S7-1500 (or any PLC/device capable of HTTP POST requests)

---

## Notion setup

### 1. Create the database

Create a new full-page database in Notion with the following columns:

| Column name  | Type        | Notes                          |
|--------------|-------------|--------------------------------|
| `ID`         | Title       | Record identifier (e.g. EVENT-001) |
| `status`     | Number      | PackML state code (0–17)       |
| `machineName`| Text        | Human-readable machine name    |
| `machineID`  | Text        | Unique machine identifier      |

> **Timestamp** is not a separate column — the dashboard uses Notion's built-in `created_time` for each record.

<!-- Add a screenshot of your database here -->

### 2. Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New connection**
3. Give it a name (e.g. `oee-dashboard`)
4. Select the correct workspace
5. Set **Authentication method** to `Access token`
6. Copy the generated token — you will need it to run the dashboard and to configure the PLC

<!-- Add a screenshot of the integration page here -->

### 3. Connect the integration to the database

1. Open your database page in Notion
2. Click **⋯** (top right) → **Connections**
3. Search for your integration name and select it
4. Also connect it on every **parent page** up to the workspace root, otherwise the API returns a 404

> **Important:** Notion permissions do not automatically inherit downward. The integration must be connected at the database level **and** at each parent page level.

<!-- Add a screenshot of the Connections menu here -->

### 4. Find the database ID

Open the database as a full page in your browser. The URL will look like:

```
https://app.notion.com/p/My-Database-<page-id>?v=<view-id>
```

- The **database ID** is `<page-id>` — the 32-character hex string before `?v=`
- The **view ID** after `?v=` is not the database ID

---

## PLC setup (S7-1500)

On every PackML state change, the PLC should send an HTTP POST to:

```
POST https://api.notion.com/v1/pages
```

**Headers:**

```
Authorization: Bearer <your-integration-token>
Notion-Version: 2022-06-28
Content-Type: application/json
```

**Body:**

```json
{
  "parent": {
    "database_id": "<your-database-id>"
  },
  "properties": {
    "ID": {
      "title": [{ "text": { "content": "EVENT-001" } }]
    },
    "status": {
      "number": 6
    },
    "machineName": {
      "rich_text": [{ "text": { "content": "Machine A" } }]
    },
    "machineID": {
      "rich_text": [{ "text": { "content": "MCH-123" } }]
    }
  }
}
```

Replace `6` with the actual PackML state code and fill in the machine details.

---

## PackML state codes

| Code | State        | Code | State        |
|------|--------------|------|--------------|
| 0    | Undefined    | 9    | Aborted      |
| 1    | Clearing     | 10   | Holding      |
| 2    | Stopped      | 11   | Held         |
| 3    | Starting     | 12   | Unholding    |
| 4    | Idle         | 13   | Suspending   |
| 5    | Suspended    | 14   | Unsuspending |
| 6    | Execute      | 15   | Resetting    |
| 7    | Stopping     | 16   | Completing   |
| 8    | Aborting     | 17   | Complete     |

---

## Running the dashboard

1. Put `server.js` and `index.html` in the same folder
2. Start the proxy server:

```bash
node server.js
```

3. Open your browser at [http://localhost:3000](http://localhost:3000)
4. Enter your Notion integration token and database ID
5. Click **Load Data**

No `npm install` is needed — the proxy server uses only built-in Node.js modules.

---

## File overview

```
├── server.js      # Node.js proxy server (no dependencies)
└── index.html     # Dashboard UI (single file, all CSS and JS included)
```

---

## Notes

- Notion's `created_time` has **minute precision**. If multiple state changes happen within the same minute, the dashboard uses Notion's internal record order as a tiebreaker to reconstruct the correct sequence.
- The dashboard **does not modify** any data in Notion — it is read-only.
- Tokens and database IDs are entered in the browser and sent only to the local proxy server. They are never stored or logged.
