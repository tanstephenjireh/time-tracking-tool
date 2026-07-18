# Time-Tracking Dashboard MVP

A full-stack MVP application built for internal Operations/Customer Success teams to track time allocation per category and per client. The system ingests raw Google Calendar events and uses a custom AI Proxy to accurately classify each event into one of 15 fixed categories and deduce the associated client.

---

## 🏗️ Architecture Choices

- **Next.js (App Router) + TypeScript**: Provides a robust, unified full-stack environment where the frontend React components and the backend API routes share the exact same strict TypeScript definitions.
- **SQLite + Prisma**: Perfect for a local-first MVP. The database is stored locally in a portable `.db` file, requiring zero external infrastructure setup. The schema strongly types our `Employee`, `Company`, `Event`, and `ProcessedEvent` models.
- **Tailwind CSS**: Utility-first styling approach matching the internal color palette requirements quickly and cleanly without the bloat of heavy component libraries.
- **Database-as-Cache Pattern**: To ensure the dashboard always loads instantly regardless of dataset size, the frontend exclusively reads pre-aggregated stats from the `ProcessedEvent` table. The dashboard never triggers external API or AI calls on load. Syncing is explicitly decoupled and runs asynchronously.
- **AI Proxy Batching & Retries**: Calendar processing relies on an LLM proxy. To prevent overwhelming it (and the wallet), events are deduplicated logically and batched (default 2 concurrent) with an exponential backoff strategy for rate limit safety.

## 🤖 AI Prompt & Output Strategy

To enforce the fixed list of 15 categories and valid client deductions, the AI prompt is highly structured:
1. **Schema Enforcement**: The proxy uses a rigid JSON schema (`output_schema`) defining exactly 3 properties: `category`, `client_name`, `client_id`. The `category` is an explicit Enum.
2. **Context Passing**: We pass the localized `known_companies` list so the LLM can cross-reference email domains and mentioned company names accurately, significantly reducing hallucinations.
3. **Database Validation**: Even after the LLM returns a client ID, our backend explicitly validates that ID against the `Company` table before writing it. If it hallucinated or failed to find a client (e.g., for internal tasks or PTO), it stores `null`.

---

## 🚀 Getting Started

Follow these instructions to run the application locally.

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
Copy the example environment file and fill in your actual credentials (the external API and proxy keys).
```bash
cp .env.example .env
```
Ensure your `.env` contains:
- `DATABASE_URL="file:./dev.db"`
- `RESOURCES_API_KEY="your_api_key"`
- `AI_PROXY_URL="https://fasttrack-2-1035702834144.europe-west1.run.app/api/ai-proxy/structured"`
- `AI_PROXY_EMAIL="your_auth_email"`
- `AI_PROXY_API_KEY="your_ai_proxy_password"`
- `AI_PROXY_BATCH_SIZE="2"`

### 3. Initialize the Database
Run the Prisma migration to create the SQLite database:
```bash
npx prisma migrate dev --name init
```
*(The real employees, clients, and events will be fetched and saved during the first background sync)*

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing and Validation

The application utilizes the native Node.js test runner for basic validations. The test suite and validation reports confirm that all MVP constraints have been met, including the strict TypeScript and SQLite constraints.
```bash
npm run test
npm run lint
npx tsc --noEmit
```