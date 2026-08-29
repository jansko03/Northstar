# Onboarding — continuing development on Northstar

This doc is for getting your laptop set up so you can run Claude Code on this
project and keep building it. You don't need to know how to code — Claude
Code will write the code. You just need the tools installed and Claude
pointed at the right instructions.

## 1. Install the tools

1. **Git** — download from https://git-scm.com/downloads and install with
   default options.
2. **Node.js** — download the **LTS** version from https://nodejs.org and
   install with default options. (This project was built on Node 24, but
   any current LTS works.)
3. **VS Code** (recommended editor) — https://code.visualstudio.com/download
4. **Claude Code** — install by following
   https://docs.claude.com/en/docs/claude-code/setup. The short version:
   open a terminal (on Windows use "Git Bash", which Git installs for you)
   and run:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
   Then sign in when it asks (it'll open a browser to log into your
   Claude/Anthropic account).

## 2. Get the code

Ask Janko for access to the GitHub repo (`jansko03/Northstar`), then in a
terminal:

```
git clone git@github.com:jansko03/Northstar.git
cd Northstar
npm install
```

If `git clone` asks for a password and rejects it — GitHub needs an SSH key
or a personal access token, not your password. Ask Janko or search
"GitHub SSH key setup" — Claude Code can also walk you through this once
you're in the project folder.

## 3. Database config (.env.local)

The app needs a database connection to work. Normally this kind of thing is
kept out of GitHub, but for this project `.env.local` **is** committed to
the repo on purpose — read the comment at the top of that file for why (short
version: it's a low-stakes solo project, the key is designed to be public,
and it saves you a manual setup step). So this step is already done for
you: after `git clone`, `.env.local` will already be sitting in the project
root with working credentials in it. You don't need to do anything here.

If you ever see `.env.example` referenced — that's just a fake-value
template kept for reference, ignore it.

## 4. Run the app

From inside the `Northstar` folder:

```
npm run dev
```

This prints a local URL (something like `http://localhost:5173`) — open it
in your browser. Leave this terminal window running while you work; it
auto-reloads the page as code changes.

## 5. Working with Claude Code

Open a terminal in the `Northstar` folder and run:

```
claude
```

This starts an interactive session. A few things worth knowing:

- **Read `CLAUDE.md` first** (it's in the project root). It's the rulebook
  for this project — visual style, data model, which screen to build next,
  and things that are explicitly *not* allowed yet (like auth, email
  sending, or a component library). Claude reads it automatically every
  session, but it's worth you reading it once too so you understand what
  Claude is doing and why.
- Just describe what you want in plain English, e.g. "the /pulse screen
  needs a filter for dormant contacts" or "there's a bug where notes don't
  save." You don't need to write code or know file names.
- Claude Code will ask for permission before doing things like installing
  packages or running certain commands — that's normal, just review and
  approve.
- If something looks broken after Claude makes a change, tell it what you
  see (a screenshot helps) rather than trying to fix it yourself.
- Don't ask Claude to add auth, email/AI drafting, calendar sync, scraping,
  or multi-user/sharing features — see the "What NOT to build" section in
  `CLAUDE.md`. If a request seems to need one of those, flag it to Janko
  first.
- Commit and push your own work when you're happy with it:
  ```
  git add -A
  git commit -m "short description of what changed"
  git push
  ```
  Claude Code can do this for you too if you just ask it to "commit and
  push" — it will show you what it's about to commit first.

## 6. Where things are (for your own orientation, not required reading)

- `src/screens/` — one file per page (Network, Import, Pulse, ContactDetail,
  Profile)
- `src/lib/supabase.ts` — the database connection (don't touch the
  `DEFAULT_USER_ID` constant — see CLAUDE.md)
- `db/schema.sql` — the database structure and the `contact_score` view that
  ranks contacts (scoring logic lives here, not in the app code)

If you get stuck, the fastest path is usually to just ask Claude Code "how
does X work in this project?" — it can read and explain the code to you.
