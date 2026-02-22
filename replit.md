# GradeINT - Enterprise Examination Platform

## Overview

GradeINT is a design-first, clickable web prototype for an offline-first exam delivery and cloud grading system. The application provides a polished, Microsoft 365-caliber UI for formal education assessment that:

- Delivers exams with offline capability
- Seals responses at exam end to prevent tampering
- Provides explainable grading with criteria, reasoning, and evidence
- Gives teachers full control to review, override, and audit grading outcomes
- Supports multiple user roles: Admin, Teacher, Student, and Invigilator

This is a prototype focused on UI/UX flows with mocked data and simulated grading.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, React hooks for local state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Design System**: Enterprise-grade UI with CSS variables for theming, Inter font family

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Build**: Custom build script using esbuild for server, Vite for client

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Managed via drizzle-kit with `db:push` command
- **Session Storage**: connect-pg-simple for PostgreSQL session storage

### Authentication
- **Current Implementation**: Mock authentication for prototype purposes
- **Storage**: localStorage-based session simulation
- **User Selection**: Dropdown-based role selection (Admin, Teacher, Student, Invigilator)

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/   # UI components (shadcn/ui)
│       ├── hooks/        # Custom React hooks
│       ├── pages/        # Route components
│       └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts     # API route handlers
│   ├── storage.ts    # Database access layer
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Drizzle table definitions
│   └── routes.ts     # API route contracts with Zod
└── migrations/       # Database migrations
```

### Key Design Patterns
- **Shared Types**: Schema and route definitions shared between frontend and backend
- **Type-Safe API**: Zod schemas for request/response validation
- **Component Architecture**: Atomic design with shadcn/ui primitives
- **Storage Abstraction**: Interface-based storage layer for database operations

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Component Libraries
- **Radix UI**: Accessible primitive components (dialogs, dropdowns, forms, etc.)
- **shadcn/ui**: Pre-styled component collection built on Radix
- **Lucide React**: Icon library

### State & Data Fetching
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Form state management with Zod resolver

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **tailwind-merge**: Intelligent class merging

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development