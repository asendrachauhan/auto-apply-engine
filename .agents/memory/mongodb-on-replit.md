---
name: Running MongoDB apps on Replit
description: How to get a Node/Mongoose app running on Replit when it expects MongoDB Atlas
---

Replit has no managed MongoDB integration or connector. For an imported app that
expects `MONGODB_URI` (e.g. built for MongoDB Atlas + Railway/Vercel deploy),
the working approach is:

- `installSystemDependencies({ packages: ["mongodb"] })` installs `mongod` via nix
  (package name is `mongodb`, not `mongodb-6_0` or similar versioned names).
- Run `mongod` as its own console workflow, pointed at a local `--dbpath` (e.g.
  `.data/mongodb`), bound to `127.0.0.1`. Add that data dir to `.gitignore` AND
  `git rm -r --cached` it if mongod already wrote files before the ignore was added —
  the completion code review rejects tasks that leave DB engine/journal files tracked.
- Point the app's `MONGODB_URI` at `mongodb://127.0.0.1:27017/<dbname>`.

**Why:** No Atlas-equivalent exists on-platform; a local `mongod` workflow is the
only way to get the app running without asking the user for external Atlas
credentials up front.

**How to apply:** When an imported project's setup docs mention MongoDB Atlas,
default to local `mongod` for dev unless the user already has an Atlas URI to provide.
