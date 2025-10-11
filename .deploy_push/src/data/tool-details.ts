import type { ToolDetail } from '@/lib/types'

export const toolDetails: Record<string, ToolDetail> = {
  'test-track': {
    slug: 'test-track',
    summary:
      'TEST Track gives bronch lab directors a command center for simulation day, combining scenario templates, real-time scoring, and readiness tracking in one place.',
    features: [
      {
        title: 'Scenario Builder',
        description:
          'Drag-and-drop editor with validated learning objectives, checklists, and complication prompts tuned for rigid bronchoscopy, EBUS, and airway stenting.',
      },
      {
        title: 'Live Assessment Dashboards',
        description:
          'Track learner performance, faculty comments, and remediation tasks as the session unfolds with instant PDF export.',
      },
      {
        title: 'Equipment Readiness',
        description:
          'QR-enabled scanning and expiring item alerts keep bronch carts, scopes, and instruments calibrated and ready.',
      },
      {
        title: 'Milestone Reporting',
        description:
          'Automatically map assessments to ACGME milestones and email stakeholders a summarized report after each lab.',
      },
    ],
    useCases: [
      'Prepping a multi-station bronchoscopy bootcamp with shared templates',
      'Tracking faculty scoring variance across simulation cohorts',
      'Documenting remediation plans and longitudinal progression for each fellow',
    ],
    gettingStarted: {
      requirements: ['Node.js 18+', 'PostgreSQL 14+', 'GitHub App with repo permissions'],
      steps: [
        'Clone the repository and copy `.env.example` to `.env.local`.',
        'Provision a PostgreSQL database and run `pnpm prisma migrate deploy`.',
        'Seed the database with `pnpm exec ts-node scripts/seed-scenarios.ts`.',
        'Start the development server with `pnpm dev` and sign in using your GitHub account.',
      ],
    },
    demoLinks: [
      {
        label: 'Simulation day walkthrough',
        href: 'https://demo.interventionalpulm.org/test-track',
        description: 'Click through an annotated simulation session using sample data.',
      },
    ],
    documentationLinks: [
      {
        label: 'Architecture overview',
        href: 'https://github.com/interventional-pulm/test_track/wiki/Architecture',
      },
      {
        label: 'Assessment rubric guide',
        href: 'https://github.com/interventional-pulm/test_track/wiki/Rubrics',
      },
    ],
    supportLinks: [
      { label: 'Slack community', href: 'https://interventionalpulm.org/slack' },
      {
        label: 'GitHub discussions',
        href: 'https://github.com/orgs/interventional-pulm/discussions',
      },
    ],
  },
  'test-reg': {
    slug: 'test-reg',
    summary:
      'TEST-Reg streamlines regulatory document control for airway clinical trials, bringing coordinators, monitors, and investigators into a single workflow.',
    features: [
      {
        title: 'Versioned Document Vault',
        description:
          'Securely store protocols, consent forms, and device documentation with automatic watermarking and audit history.',
      },
      {
        title: 'Submission Scheduler',
        description:
          'Plan continuing review, safety report, and device reporting deadlines with calendar sync and reminders.',
      },
      {
        title: 'Consent Tracking',
        description:
          'Monitor participant consent status across sites with alerts for expiring or missing signatures.',
      },
      {
        title: 'Role-Based Access',
        description:
          'Granular permissions ensure auditors see what they need without exposing sensitive site notes.',
      },
    ],
    useCases: [
      'Coordinating device study submissions across academic and community sites',
      'Preparing for an FDA inspection with a live audit trail',
      'Sharing updated consent packets with remote monitors and site leads',
    ],
    gettingStarted: {
      requirements: [
        'Node.js 18+',
        'Supabase project or Postgres instance',
        'SendGrid API key for notifications',
      ],
      steps: [
        'Fork the repository and configure Supabase tables using the provided SQL migrations.',
        'Set environment variables for storage bucket, auth secrets, and email provider.',
        'Run `pnpm dev` and invite trial coordinators through the admin console.',
      ],
    },
    demoLinks: [
      {
        label: 'Regulatory binder demo',
        href: 'https://demo.interventionalpulm.org/test-reg',
      },
    ],
    documentationLinks: [
      {
        label: 'Data model',
        href: 'https://github.com/interventional-pulm/Test_reg/wiki/Data-Model',
      },
      {
        label: 'Deployment checklist',
        href: 'https://github.com/interventional-pulm/Test_reg/wiki/Deployment',
      },
    ],
  },
  medparse: {
    slug: 'medparse',
    summary:
      'MedParse stitches together NLP pipelines so clinicians can turn raw notes and pathology PDFs into structured airway procedure plans in minutes.',
    features: [
      {
        title: 'Document Normalization',
        description:
          'Processes scanned PDFs, DICOM headers, and HL7 feeds into consistent text blocks for analysis.',
      },
      {
        title: 'Custom Entities',
        description:
          'Extracts device names, anatomical landmarks, and staging systems specific to interventional pulmonology.',
      },
      {
        title: 'Plan Composer',
        description:
          'Generates editable procedure plans with recommended codes, supplies, and follow-up tasks.',
      },
      {
        title: 'Feedback Loop',
        description: 'Clinician edits feed back into the model, improving accuracy with each case.',
      },
    ],
    useCases: [
      'Pre-visit planning for complex airway cases',
      'Structured documentation for registry submissions',
      'Automating multidisciplinary conference summaries',
    ],
    gettingStarted: {
      requirements: [
        'Python 3.11',
        'CUDA-capable GPU optional',
        'Access to de-identified clinical documents',
      ],
      steps: [
        'Create a virtual environment and install dependencies with `pip install -r requirements.txt`.',
        'Download the base spaCy model with `python -m spacy download en_core_sci_md`.',
        'Run `uvicorn app.main:app --reload` to start the API and open the included Swagger docs.',
      ],
    },
    demoLinks: [
      {
        label: 'Interactive API docs',
        href: 'https://demo.interventionalpulm.org/medparse',
      },
    ],
    documentationLinks: [
      {
        label: 'Pipeline configuration',
        href: 'https://github.com/interventional-pulm/Medparse/wiki/Pipelines',
      },
      {
        label: 'Entity schema',
        href: 'https://github.com/interventional-pulm/Medparse/wiki/Entity-Schema',
      },
    ],
    supportLinks: [
      {
        label: 'Model tuning guide',
        href: 'https://github.com/interventional-pulm/Medparse/wiki/Tuning',
      },
    ],
  },
  'ip-assist-lite': {
    slug: 'ip-assist-lite',
    summary:
      'IP Assist Lite puts the most requested airway calculators, timers, and checklists into a fast, offline-capable mobile app.',
    features: [
      {
        title: 'Offline Mode',
        description:
          'Preloads calculators and protocol content so procedure rooms with poor Wi-Fi stay covered.',
      },
      {
        title: 'Team Checklist',
        description:
          'Real-time checklist that multiple team members can update with instant sync when connectivity returns.',
      },
      {
        title: 'Sedation & Dosing Tools',
        description: 'Weight-based calculators with customizable defaults and safety guardrails.',
      },
      {
        title: 'Reference Library',
        description:
          'Host equipment sizing charts, troubleshooting guides, and video pearls for quick consults.',
      },
    ],
    useCases: [
      'On-call fellow prepping for emergent bronchoscopy',
      'Nurse-led checklist before stent deployment',
      'Rapid access to airway sizing charts in community hospitals',
    ],
    gettingStarted: {
      requirements: [
        'Node.js 18+',
        'Expo CLI',
        'Apple/Google developer accounts for native builds',
      ],
      steps: [
        'Install dependencies with `pnpm install` and run `pnpm expo start` for development.',
        'Customize the bundled pathway content in `apps/mobile/content`.',
        'Configure push notifications and sync by editing `apps/mobile/app.config.ts`.',
      ],
    },
    demoLinks: [
      { label: 'Expo Go preview', href: 'https://expo.dev/@interventionalpulm/ip-assist-lite' },
    ],
    documentationLinks: [
      {
        label: 'Content authoring guide',
        href: 'https://github.com/interventional-pulm/IP_assist_lite/wiki/Content',
      },
      {
        label: 'Offline sync architecture',
        href: 'https://github.com/interventional-pulm/IP_assist_lite/wiki/Offline',
      },
    ],
  },
  endoreels: {
    slug: 'endoreels',
    summary:
      'EndoReels captures procedural video, overlays commentary, and bundles content into competency-based playlists for fellows and faculty.',
    features: [
      {
        title: 'Multi-stream Sync',
        description:
          'Combine scope feed, fluoroscopy, ultrasound, and vitals into one synchronized timeline.',
      },
      {
        title: 'Annotation Studio',
        description:
          'Mark teaching moments, complications, and decisions with chapter markers and drawing tools.',
      },
      {
        title: 'Playlist Builder',
        description:
          'Assemble case libraries with objectives, pre-reading, and reflection prompts.',
      },
      {
        title: 'Compliance Safeguards',
        description:
          'Automatically blur PHI, enforce retention policies, and log view history for governance.',
      },
    ],
    useCases: [
      'Creating flipped classroom assignments for the weekly fellow conference',
      'Conducting morbidity and mortality review with exact timestamps',
      'Sharing anonymized snippets with referring physicians or trainees',
    ],
    gettingStarted: {
      requirements: ['Mux or similar video provider', 'S3-compatible storage', 'Node.js 18+'],
      steps: [
        'Configure environment variables for Mux, storage, and authentication per `.env.example`.',
        'Run the database migrations with `pnpm prisma migrate dev`.',
        'Upload sample clips using the admin dashboard seeding script.',
      ],
    },
    demoLinks: [
      { label: 'Annotated case tour', href: 'https://demo.interventionalpulm.org/endoreels' },
    ],
    documentationLinks: [
      {
        label: 'Video ingestion pipeline',
        href: 'https://github.com/interventional-pulm/Endoreels/wiki/Ingestion',
      },
      {
        label: 'Annotation schema',
        href: 'https://github.com/interventional-pulm/Endoreels/wiki/Annotations',
      },
    ],
  },
  'pocus-review': {
    slug: 'pocus-review',
    summary:
      'POCUS Review offers curated ultrasound loops with expert-guided interpretation pathways and spaced repetition review.',
    features: [
      {
        title: 'Case Packs',
        description:
          'Download structured packs that bundle loops, checklists, and interpretation keys.',
      },
      {
        title: 'Adaptive Review',
        description:
          'Learners rate confidence and receive tailored follow-up cases using spaced repetition.',
      },
      {
        title: 'Community Notes',
        description: 'Faculty can append pearls and pitfalls that surface during similar cases.',
      },
      {
        title: 'Offline First',
        description:
          'Progressive web app caches loops and transcripts for use in low-connectivity settings.',
      },
    ],
    useCases: [
      'Fellow self-study between pleural procedure rotations',
      'Group review of difficult thoracentesis cases during conference',
      'Credentialing modules for advanced practice providers',
    ],
    gettingStarted: {
      requirements: ['Node.js 18+', 'Supabase project', 'Mux signing key for streaming'],
      steps: [
        'Clone the repository and create a new Supabase project for auth and storage.',
        'Run `pnpm db:push` to apply schema migrations.',
        'Seed demo case packs with `pnpm exec ts-node scripts/seed-cases.ts`.',
        'Start the application locally using `pnpm dev`.',
      ],
    },
    demoLinks: [
      { label: 'Interactive case', href: 'https://demo.interventionalpulm.org/pocus-review' },
    ],
    documentationLinks: [
      {
        label: 'Case authoring guide',
        href: 'https://github.com/interventional-pulm/POCUS-review/wiki/Authoring',
      },
      {
        label: 'Review algorithm',
        href: 'https://github.com/interventional-pulm/POCUS-review/wiki/SRS',
      },
    ],
    supportLinks: [
      { label: 'Implementation channel', href: 'https://interventionalpulm.org/slack#pocus' },
    ],
  },
}

export const toolSlugs = Object.keys(toolDetails)
