# Local School Exam Server
## Phase 3 Placeholder

This app will be built in Phase 3 of the GradeINT build plan.

**Tech stack:**
- Tauri (Rust shell)
- React/TypeScript (operator dashboard UI)
- Node.js Express sidecar (LAN API server)
- SQLite (local submissions database)

**Responsibilities:**
- Authenticate with cloud and download exam packages
- Activate exam sessions locally
- Expose LAN API for Student Exam Clients
- Collect autosaves and final submissions
- Seal submissions at exam end
- Sync sealed submissions to cloud

See `/docs/deployment-model.md` for full specification.
