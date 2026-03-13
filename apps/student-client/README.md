# Student Exam Client
## Phase 4 Placeholder

This app will be built in Phase 4 of the GradeINT build plan.

**Tech stack:**
- Tauri (Rust shell)
- React/TypeScript (exam runtime UI)
- SQLite (local answer cache)

**Responsibilities:**
- Connect to Local School Exam Server over LAN
- Authenticate as candidate (no browser, no internet)
- Download and cache exam package
- Render exam UI with timer and autosave
- Recover from crash/restart
- Submit to local server and display receipt

See `/docs/deployment-model.md` for full specification.
