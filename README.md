## Tech Stack

**Backend:**

*   **Framework:** Node.js, Express.js
*   **Language:** TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **Authentication:** JWT (jsonwebtoken), bcrypt
*   **Scheduling:** node-cron
*   **Email:** Nodemailer
*   **Other:** Helmet (Security Headers), CORS, Morgan (Logging), Compression, Express Rate Limit

**Frontend:**

*   **Framework/Library:** React
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **UI Library:** Material UI (MUI)
*   **Data Fetching/Caching:** TanStack Query
*   **HTTP Client:** Axios
*   **Charting:** Chart.js
*   **Forms:** Formik, Yup (Validation)
*   **Routing:** React Router

## Getting Started

### Prerequisites

*   Node.js 
*   npm or yarn

### Backend Setup (`server/`)

1.  **Navigate to the server directory:**
    ```bash
    cd server
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up Environment Variables:**
    *   Create a `.env` file in the `server/` directory.
    *   Copy the contents of the example `server/.env` provided below.
    *   **Crucially, update `DATABASE_URL` to point to your database.**
    *   Update other variables like `JWT_SECRET`, `CORS_ORIGIN`, and `MAIL_*` settings as needed for your environment.

4.  **Run Database Migrations:**
    ```bash
    npx prisma migrate dev
    ```
    This will sync your database schema with `prisma/schema.prisma`.

5.  **Run the backend server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The server should start on the port defined in your `server/.env` (e.g., 3001).

### Frontend Setup (`client/`)

1.  **Navigate to the client directory:**
    ```bash
    cd ../client
    # (from the server directory)
    # or cd client (from the root)
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up Environment Variables:**
    *   The frontend needs to know the base URL of the backend API. This is configured via the `VITE_API_BASE_URL` environment variable.
    *   **For Development:** If you don't create a `.env` file in the `client/` directory, the frontend will default to `http://localhost:3001/api`
    *   **For Production:** Define `VITE_API_BASE_URL` either in your build environment or in a `client/.env.production` file. It should point to the deployed backend API URL.
        ```dotenv
        # client/.env.production
        VITE_API_BASE_URL=https://your-deployed-backend.com/api
        ```

4.  **Run the frontend development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
## Environment Variables

### Backend (`server/.env`) (For development)

Create this file in the `server/` directory. **Replace placeholders and secrets. Most configurations have defaults**

```dotenv
# --- Application ---
NODE_ENV=development # or production
PORT=3001

# --- Database ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# --- CORS Origins ---
# The URL of your frontend application (can be comma-separated for multiple origins in production)
CORS_ORIGIN="http://localhost:5173"

# --- Security ---
JWT_SECRET="<Your JWT Secret Here>"

# --- Mailer ---
MAIL_HOST="smtp.example.com"
MAIL_PORT="587"
MAIL_SECURE="false"
MAIL_TLS="true"
MAIL_USER="your_smtp_username"
MAIL_PASS="your_smtp_password_or_api_key"
MAIL_FROM='"Your App Name" <noreply@example.com>'

# --- Monitoring & Scheduler ---
MONITOR_CONCURRENCY=5
REQUEST_TIMEOUT=10000
DEFAULT_MONITOR_INTERVAL_SECONDS=300
MINIMUM_MONITOR_INTERVAL_SECONDS=30
MONITORING_RESULTS_TO_KEEP=2000
RECHECK_DELAY_SECONDS=60

# --- Scheduler Cron Patterns (Defaults run checks every 30s, cleanup hourly, purge daily at 2 AM) ---
MONITOR_CRON_PATTERN="*/30 * * * * *"
CLEANUP_CRON_PATTERN="0 * * * *"
PURGE_CRON_PATTERN="0 2 * * *"

