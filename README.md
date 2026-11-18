# WorkforceIQ

WorkforceIQ is a role-based employee skill utilization platform for employees,
employers, staffing teams, and administrators.

## Repository layout

- `client/` - React, Vite, Tailwind CSS frontend
- `server/` - Express REST API and MongoDB domain layer
- `docs/` - architecture, schema, API, and roadmap documentation

## Local development

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Configure MongoDB, Firebase, and Gemini credentials in `.env`.
4. In Firebase Console, open **Authentication** and choose **Get started**.
   Under **Sign-in method**, enable **Email/Password**. Ensure `localhost` is
   listed under Authentication's authorized domains.
5. Run `npm install`.
6. Run `npm run dev`. Restart the dev server whenever `.env` changes.

The client runs at `http://localhost:5174`; the API runs at
`http://localhost:5050`.

## Scripts

- `npm run dev` - run client and server concurrently
- `npm run build` - build the production frontend
- `npm start` - start the production API
- `npm test` - run server tests
- `npm run seed:skills` - add starter skills to MongoDB
- `npm run lint` - lint both workspaces
