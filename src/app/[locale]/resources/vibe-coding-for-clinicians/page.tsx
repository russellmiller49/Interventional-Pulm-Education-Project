import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Code2,
  ExternalLink,
  ListChecks,
  ShieldCheck,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Vibe Coding for Clinicians',
  description:
    'A beginner-friendly companion for clinicians learning AI-assisted coding, IDEs, GitHub, and agentic workflows.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const sectionLinks = [
  ['start', 'Start here'],
  ['why-ip', 'Why IP needs this'],
  ['workflow', 'Core workflow'],
  ['tool-stack', 'Tool stack chooser'],
  ['ide', 'IDE basics'],
  ['github', 'GitHub basics'],
  ['agents', 'Agentic coding'],
  ['prompts', 'Prompt library'],
  ['projects', 'Starter projects'],
  ['safety', 'Safety and governance'],
  ['learning-plan', '30-day plan'],
  ['resources', 'Curated links'],
  ['glossary', 'Glossary'],
] as const

const openingCards = [
  {
    label: 'Clinician',
    title: 'Your advantage',
    body: 'You know the messy workflow, the edge cases, the language clinicians use, and what would actually be useful in clinic, in the bronchoscopy suite, or in a fellow course.',
  },
  {
    label: 'AI assistant',
    title: 'The assistant advantage',
    body: 'It can scaffold code, explain unfamiliar libraries, write tests, refactor files, and help debug without tiring of the iteration loop.',
  },
  {
    label: 'Human review',
    title: 'The non-negotiable',
    body: 'You decide whether the result is accurate, safe, maintainable, and appropriate for the intended educational, research, or workflow setting.',
  },
] as const

const ipCards = [
  {
    label: 'Registry and documentation',
    title: 'Turn notes into structure',
    body: 'Extract EBUS station, needle passes, adequacy, ROSE, complications, specimens, CPT hints, and registry fields from synoptic text.',
  },
  {
    label: 'Education and training',
    title: 'Build the course you wanted',
    body: 'Create interactive bronchoscopy anatomy, TNM staging practice, EBUS knobology, board review cases, simulation labs, and feedback loops.',
  },
  {
    label: 'Research',
    title: 'Lower the friction',
    body: 'Screen abstracts, classify cases, generate tables, build dashboards, track enrollment, and standardize data collection.',
  },
  {
    label: 'Clinical prototypes',
    title: 'Prototype cautiously',
    body: 'Educational calculators, guideline summaries, and checklists can be useful, but patient-specific recommendations need validation and governance.',
  },
] as const

const workflowSteps = [
  [
    'Describe the clinical problem',
    'State the user, setting, input, output, and success criteria. "Build an EBUS station quiz for fellows" is better than "make an app."',
  ],
  [
    'Plan before coding',
    'Use a chat assistant to turn the idea into requirements, a feature list, a data model, and first-version scope.',
  ],
  [
    'Generate small pieces',
    'Ask for one component, one script, or one route at a time. Large prompts are fine for planning; small prompts are better for reliable implementation.',
  ],
  [
    'Run and test',
    'Use the IDE terminal. Copy exact error messages back to the assistant. Ask for reproducible checks, not just another attempt.',
  ],
  [
    'Refine with domain expertise',
    'Correct medical language, workflows, and edge cases. Ask AI to critique the product, not just write code.',
  ],
  [
    'Commit, review, and share',
    'Use GitHub as project memory. Save checkpoints, create issues, get review, and deploy only when the risk level is appropriate.',
  ],
] as const

const toolRows = [
  [
    'Learn the workflow',
    'Chat assistant + Google Colab',
    'No local setup. Good for Python, data, and concept learning.',
    'Parse 20 synthetic CT reports into a CSV.',
  ],
  [
    'Build a research dashboard',
    'Python + Streamlit + GitHub',
    'Fast path from a data table to an interactive app.',
    'Bronchoscopy complication dashboard from a de-identified CSV.',
  ],
  [
    'Build a teaching app',
    'VS Code, Cursor, or Windsurf + React/Vite',
    'Best for interactive UI, quizzes, anatomy diagrams, and mobile-responsive teaching tools.',
    'EBUS station flashcards with a 20-question quiz.',
  ],
  [
    'Maintain a real codebase',
    'VS Code + Copilot, Cursor, or Codex',
    'Good balance of manual control, codebase context, chat, and version control.',
    'Refactor an existing app and add tests.',
  ],
  [
    'Delegate multi-file work',
    'Codex, Claude Code, or Copilot coding agent',
    'Agents can inspect the repo, edit files, run commands, and summarize changes.',
    'Add a new TNM staging module to an existing course app.',
  ],
] as const

const toolTiers = [
  {
    label: 'Tier 1',
    title: 'Chat-based assistants',
    body: 'ChatGPT, Claude, and similar tools are useful for planning, explaining code, drafting prompts, summarizing errors, and small snippets.',
  },
  {
    label: 'Tier 2',
    title: 'IDE-integrated assistants',
    body: 'GitHub Copilot in VS Code, Cursor, and Windsurf are strongest when the assistant can see the files you are editing.',
  },
  {
    label: 'Tier 3',
    title: 'Agentic coding tools',
    body: 'Codex, Claude Code, and coding agents are best for multi-file changes, tests, pull requests, and codebase exploration.',
  },
] as const

const ideCards = [
  {
    title: 'VS Code',
    body: 'Free, widely used, and supported by a large extension ecosystem, GitHub Copilot, terminals, notebooks, and many language plugins.',
    href: 'https://code.visualstudio.com/',
  },
  {
    title: 'Cursor',
    body: 'An AI-native editor designed around agents and codebase context. Useful when you want coordinated edits across a project.',
    href: 'https://cursor.com/',
  },
  {
    title: 'Windsurf',
    body: 'An AI coding editor focused on agentic development, flow, browser context, terminal commands, and iterative app building.',
    href: 'https://windsurf.com/editor',
  },
  {
    title: 'Jupyter / Colab',
    body: 'Notebook environments are excellent for research data, Python, statistics, and teaching. They are a great first scripting surface.',
    href: 'https://jupyter.org/',
  },
] as const

const ideAreas = [
  ['File explorer', 'Shows project folders and files. Ask AI to explain the folder structure.'],
  [
    'Editor',
    'Where files open. Comments can become prompts, such as "// Build a quiz component that loads questions from quizData.json".',
  ],
  ['Terminal', 'Where commands run, such as npm run dev, python app.py, or git status.'],
  ['Source control panel', 'Shows what changed. Review this before every commit.'],
  ['AI chat / agent panel', 'Where you describe tasks, review errors, and request scoped changes.'],
] as const

const gitRows = [
  ['Repository / repo', 'A project folder with history.', 'A case chart plus all revisions.'],
  ['Commit', 'A saved checkpoint with a message.', 'Procedure note signed at a point in time.'],
  [
    'Branch',
    'A safe copy for trying changes.',
    'A simulation run before changing the real workflow.',
  ],
  ['Pull request', 'A proposed set of changes for review.', 'Peer review before deployment.'],
  ['Issue', 'A to-do item, bug, or feature request.', 'Clinic task list or research tracker.'],
  ['README', 'The project front page and instructions.', 'Protocol summary.'],
  [
    '.gitignore',
    'A list of files Git should never track.',
    'Do not include PHI, secrets, exports, or temp files.',
  ],
] as const

const agentRows = [
  [
    'Codex',
    'Cloud, CLI, IDE, and app coding tasks; repo inspection; bug fixes; feature implementation.',
    'Delegate a well-scoped task and review the output.',
    'Ask for plan -> branch -> tests -> diff summary.',
  ],
  [
    'Claude Code',
    'Terminal and IDE workflows, repo-level reasoning, refactoring, explanations, and careful review.',
    'A coding collaborator living in the development environment.',
    'Use permission prompts and review shell commands.',
  ],
  [
    'GitHub Copilot coding agent',
    'Issue-driven tasks and pull-request style workflows inside the GitHub and Copilot ecosystem.',
    'Turn a detailed issue into a proposed change.',
    'Write detailed issues and review PRs like manuscripts.',
  ],
  [
    'Cursor / Windsurf agents',
    'Interactive IDE-based building with live codebase context and visual feedback.',
    'Build while watching the app run.',
    'Keep tasks small and watch the changed-files list.',
  ],
] as const

const clearCards = [
  ['C - Context', 'Clinical domain, user, setting, and why it matters.'],
  ['L - Layout', 'How you want the response or app structured.'],
  ['E - Examples', 'Sample inputs, outputs, reports, cases, screenshots, or user stories.'],
  ['A - Accuracy', 'Standards, units, guideline references, validation expectations.'],
  [
    'R - Requirements',
    'Constraints: privacy, accessibility, file formats, tests, deployment, and edge cases.',
  ],
] as const

const projectRows = [
  [
    'Procedure checklist generator',
    'Forms, conditional display, printable summaries.',
    'React/Vite or Streamlit.',
    'Low if educational and no PHI.',
  ],
  [
    'EBUS station flashcards',
    'JSON content, UI components, quiz state.',
    'React/Vite + GitHub Pages.',
    'Low.',
  ],
  [
    'Synthetic CT report nodule parser',
    'Regex, natural language parsing, CSV export.',
    'Python + Streamlit.',
    'Low with synthetic data.',
  ],
  [
    'Board review question bank',
    'Data modeling, search/filter, scoring, spaced repetition.',
    'React or Next.js.',
    'Low.',
  ],
  [
    'REDCap data dictionary generator',
    'CSV schemas, validation rules, research workflow.',
    'Python.',
    'Medium; coordinate with the research team.',
  ],
  [
    'Literature RAG assistant',
    'Embeddings, document ingestion, retrieval, citation display.',
    'Python + vector database + LLM API.',
    'Medium to high depending on use.',
  ],
  [
    'Clinical decision support prototype',
    'Guideline logic, validation, audit trails, governance.',
    'Usually more than a beginner stack.',
    'High; involve IT, compliance, and regulatory experts early.',
  ],
] as const

const safetyCards = [
  {
    label: 'Privacy',
    title: 'PHI is not prompt material',
    body: 'Use synthetic or properly de-identified data. If a vendor handles PHI for a covered entity, business associate obligations may apply.',
  },
  {
    label: 'Security',
    title: 'Secrets stay out of GitHub',
    body: 'Never commit API keys, passwords, tokens, database URLs, exports, or patient files. Use environment variables and secret managers.',
  },
  {
    label: 'Validation',
    title: 'Clinical output must be checked',
    body: 'Recommendations, registry values, coding suggestions, staging, risk scores, and triage flags need expert review and validation.',
  },
  {
    label: 'Regulatory',
    title: 'Know when it becomes device-like',
    body: 'Software that supports diagnosis or treatment may enter FDA clinical decision support or SaMD territory. Get institutional guidance early.',
  },
] as const

const checklist = [
  'No patient names, dates, MRNs, accession numbers, locations, faces, voice, or identifiers.',
  'No secrets in code, screenshots, logs, notebooks, or GitHub history.',
  'README explains purpose, limitations, install steps, and data policy.',
  'Clinical content reviewed by a domain expert.',
  'Educational disclaimer or research disclaimer included.',
  'Build or test command passes.',
  'Repo visibility set intentionally: private for early work, public only when safe.',
  'Institutional IT, IRB, compliance, or CMIO involved when appropriate.',
] as const

const learningRows = [
  [
    'Week 1',
    'Understand the loop',
    'Plan 3 small project ideas. Learn GitHub vocabulary. Run one Colab notebook.',
    'One project specification.',
  ],
  [
    'Week 2',
    'Build a small script',
    'Use Python to parse or summarize synthetic data. Ask AI to explain every line. Save to GitHub.',
    'A working script or notebook.',
  ],
  [
    'Week 3',
    'Build a simple app',
    'Use Streamlit or React/Vite to make a quiz, checklist, or dashboard. Commit daily.',
    'A local app that runs.',
  ],
  [
    'Week 4',
    'Review and share',
    'Ask AI and colleagues to critique. Add README, disclaimer, tests, and a simple sharing plan.',
    'A shareable link or private demo.',
  ],
] as const

const resourceGroups = [
  {
    title: 'AI coding assistants and IDEs',
    links: [
      ['OpenAI Codex', 'https://developers.openai.com/codex/'],
      ['OpenAI model docs', 'https://developers.openai.com/api/docs/models'],
      ['Claude Code overview', 'https://docs.anthropic.com/en/docs/claude-code/overview'],
      ['GitHub Copilot docs', 'https://docs.github.com/copilot'],
      ['Visual Studio Code', 'https://code.visualstudio.com/'],
      ['Cursor docs', 'https://cursor.com/docs'],
      ['Windsurf Editor', 'https://windsurf.com/editor'],
    ],
  },
  {
    title: 'GitHub, hosting, and deployment',
    links: [
      [
        'GitHub Hello World',
        'https://docs.github.com/en/get-started/start-your-journey/hello-world',
      ],
      [
        'About GitHub repositories',
        'https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories',
      ],
      [
        'GitHub Desktop guide',
        'https://docs.github.com/en/desktop/overview/getting-started-with-github-desktop',
      ],
      [
        'GitHub Pages',
        'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages',
      ],
      ['Vercel docs', 'https://vercel.com/docs'],
      ['Netlify docs', 'https://docs.netlify.com/'],
    ],
  },
  {
    title: 'Data apps, notebooks, and research tools',
    links: [
      ['Python documentation', 'https://www.python.org/doc/'],
      ['JupyterLab', 'https://jupyter.org/'],
      ['Google Colab FAQ', 'https://research.google.com/colaboratory/faq.html'],
      ['Streamlit docs', 'https://docs.streamlit.io/'],
      ['Gradio', 'https://gradio.app/'],
      ['Hugging Face Spaces', 'https://huggingface.co/docs/hub/spaces-overview'],
      ['REDCap', 'https://project-redcap.org/'],
    ],
  },
  {
    title: 'Medical imaging and educational assets',
    links: [
      ['3D Slicer', 'https://slicer.org/'],
      [
        '3D Slicer getting started',
        'https://slicer.readthedocs.io/en/latest/user_guide/getting_started.html',
      ],
      ['OHIF Viewer', 'https://ohif.org/'],
      ['OHIF docs', 'https://docs.ohif.org/'],
      ['ITK-SNAP', 'https://www.itksnap.org/'],
      ['The Cancer Imaging Archive', 'https://www.cancerimagingarchive.net/'],
    ],
  },
  {
    title: 'Healthcare AI safety and governance',
    links: [
      [
        'HHS HIPAA de-identification guidance',
        'https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html',
      ],
      [
        'HHS Business Associates guidance',
        'https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html',
      ],
      [
        'FDA Clinical Decision Support Software guidance',
        'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software',
      ],
      [
        'FDA Software as a Medical Device',
        'https://www.fda.gov/medical-devices/digital-health-center-excellence/software-medical-device-samd',
      ],
      [
        'NIST AI Risk Management Framework',
        'https://www.nist.gov/itl/ai-risk-management-framework',
      ],
    ],
  },
  {
    title: 'Learning resources',
    links: [
      ['GitHub Skills', 'https://skills.github.com/'],
      [
        'Getting started with Git',
        'https://docs.github.com/en/get-started/learning-to-code/getting-started-with-git',
      ],
      ['React Learn', 'https://react.dev/learn'],
      ['Vite guide', 'https://vite.dev/guide/'],
      ['Tailwind CSS docs', 'https://tailwindcss.com/docs'],
      ['Software Carpentry lessons', 'https://software-carpentry.org/lessons/'],
    ],
  },
] as const

const glossaryRows = [
  [
    'App',
    'A software tool people can use: website, dashboard, mobile app, calculator, notebook, or script.',
  ],
  ['CLI', 'Command-line interface. A text box where you run commands.'],
  [
    'Component',
    'A reusable piece of a web app, like a quiz card, navigation bar, or anatomy panel.',
  ],
  ['Dependency', 'A package your project relies on.'],
  [
    'Environment variable',
    'A private setting used for secrets like API keys. Do not hard-code secrets in files.',
  ],
  [
    'Framework',
    'A structured way to build software, such as React, Next.js, Streamlit, or Django.',
  ],
  [
    'JSON',
    'A structured text format for data. Excellent for quiz questions, case data, and configuration.',
  ],
  ['Linting', 'Automated checking for code style and common mistakes.'],
  [
    'MCP',
    'Model Context Protocol, a way for AI tools to connect to external tools and data sources. Use carefully.',
  ],
  [
    'Package manager',
    'Tool that installs dependencies, such as npm for JavaScript or uv/pip for Python.',
  ],
  ['Pull request', 'A proposed change set for review before merging into the main project.'],
  [
    'RAG',
    'Retrieval-augmented generation: an AI system that retrieves relevant documents before answering.',
  ],
  ['Static site', 'A website made of HTML, CSS, and JavaScript files that can be hosted simply.'],
  ['Test', 'Code that checks whether your code behaves as expected.'],
] as const

export default function VibeCodingForCliniciansPage() {
  return (
    <HandoffContent>
      {
        <div className="container py-8 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-28 rounded-2xl border border-border/80 bg-card/70 p-4 shadow-sm">
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Guide sections
                </p>
                <nav aria-label="Vibe coding guide sections" className="mt-3 space-y-1">
                  {sectionLinks.map(([id, label]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="block rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <article className="min-w-0 space-y-12">
              <header className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 shadow-sm md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-3xl space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="info" className="rounded-full px-3 py-1">
                        Lecture companion
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        Updated May 8, 2026
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                        Vibe Coding for Clinicians, Researchers, and Educators
                      </h2>
                      <p className="text-base leading-7 text-muted-foreground md:text-lg">
                        A beginner-friendly handbook for physicians who want to build useful
                        clinical, research, and teaching tools with AI coding assistants without
                        pretending to be software engineers.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm text-muted-foreground md:min-w-56">
                    <div className="rounded-2xl border bg-background/70 p-4">
                      <p className="font-semibold text-foreground">Audience</p>
                      <p>Beginner physician-builders</p>
                    </div>
                    <div className="rounded-2xl border bg-background/70 p-4">
                      <p className="font-semibold text-foreground">Best first use</p>
                      <p>Education, research, and workflow prototypes</p>
                    </div>
                  </div>
                </div>
              </header>

              <GuideSection
                id="start"
                kicker="1 - Start here"
                title="What vibe coding means for physicians"
              >
                <p>
                  Vibe coding means building software by describing what you want in natural
                  language, letting an AI coding assistant draft the code, testing the result, and
                  refining it through conversation. You are not handing over clinical judgment. You
                  are using AI as a fast junior developer while you remain the clinical architect.
                </p>
                <Callout tone="success" icon={CheckCircle2}>
                  You do not need to know every programming syntax rule before you begin. You need
                  to define the clinical problem clearly, test whether the output solves it, and
                  keep human review in the loop.
                </Callout>
                <CardGrid>
                  {openingCards.map((card) => (
                    <InfoCard key={card.title} {...card} />
                  ))}
                </CardGrid>
                <TwoColumnList
                  leftTitle="Good first uses"
                  leftItems={[
                    'Educational apps: board review, anatomy teaching, EBUS station practice, procedural checklists, simulation modules.',
                    'Research tools: REDCap helpers, screening logs, CSV parsers, abstract dashboards, literature extraction workflows.',
                    'Workflow prototypes: note templates, registry extraction mockups, CPT coding demos, QA dashboards.',
                  ]}
                  rightTitle="Not a shortcut for"
                  rightItems={[
                    'Sending protected health information to unapproved tools.',
                    'Replacing institutional IT, security review, IRB, compliance, or FDA review when those apply.',
                    'Shipping clinical decision support without validation.',
                  ]}
                />
              </GuideSection>

              <GuideSection
                id="why-ip"
                kicker="2 - Why this matters"
                title="IP tools are often too niche for industry"
              >
                <p>
                  Interventional pulmonology has problems that are obvious to physicians but too
                  narrow for many commercial roadmaps: registry capture from procedure notes,
                  board-style teaching tools, procedure simulators, anatomy modules, literature
                  assistants, and workflows that understand EBUS-TBNA, cryobiopsy, navigational
                  bronchoscopy, pleural procedures, valves, rigid bronchoscopy, and stent
                  surveillance.
                </p>
                <CardGrid>
                  {ipCards.map((card) => (
                    <InfoCard key={card.title} {...card} />
                  ))}
                </CardGrid>
              </GuideSection>

              <GuideSection
                id="workflow"
                kicker="3 - Core loop"
                title="The physician-builder workflow"
              >
                <StepList steps={workflowSteps} />
                <CardGrid columns="three">
                  <InfoCard
                    title="AI as workbench builder"
                    body="When a visual task is hard to describe, ask AI to create a temporary editor. Example: a hotspot placement page where you drag controls into position, copy JSON, and then delete the temporary tool after integration."
                  />
                  <InfoCard
                    title="Show, do not only describe"
                    body="For spatial bugs, layouts, 3D anatomy, ultrasound geometry, or UI problems, screenshots and target images converge faster than paragraphs."
                  />
                  <InfoCard
                    title="Make invisible state visible"
                    body="Ask for debug panels, timestamps, axes, centroids, labels, and logs. Many bugs stay hidden because you cannot see the state the code is using."
                  />
                </CardGrid>
              </GuideSection>

              <GuideSection
                id="tool-stack"
                kicker="4 - Tool stack chooser"
                title="Which tools should a beginner physician use?"
              >
                <p>
                  Do not start by learning every tool. Pick the stack that matches the current goal.
                </p>
                <DataTable
                  headers={['Goal', 'Best starter stack', 'Why', 'First project']}
                  rows={toolRows}
                />
                <h3 className="mt-8 text-xl font-semibold tracking-tight">
                  Three tiers of AI coding tools
                </h3>
                <CardGrid columns="three">
                  {toolTiers.map((card) => (
                    <InfoCard key={card.title} {...card} />
                  ))}
                </CardGrid>
              </GuideSection>

              <GuideSection
                id="ide"
                kicker="5 - IDE basics"
                title="What an IDE is, and why clinicians should care"
              >
                <p>
                  An IDE is an integrated development environment: a workspace where you view files,
                  edit code, run commands, manage Git, and debug errors. Think of it as the software
                  workbench that keeps the editor, terminal, source control, and AI assistant in one
                  place.
                </p>
                <CardGrid>
                  {ideCards.map((card) => (
                    <InfoCard key={card.title} {...card} />
                  ))}
                </CardGrid>
                <h3 className="mt-8 text-xl font-semibold tracking-tight">
                  The five IDE areas beginners should learn
                </h3>
                <StepList steps={ideAreas} />
                <Callout tone="warning" icon={AlertTriangle}>
                  Never let an agent make changes you cannot review. Learn where the diff is. A diff
                  shows exactly what changed.
                </Callout>
              </GuideSection>

              <GuideSection
                id="github"
                kicker="6 - GitHub basics"
                title="GitHub for physicians: the minimum you need"
              >
                <p>
                  Git tracks changes. GitHub stores those changes online, supports collaboration,
                  and can host simple websites. Beginners can start with GitHub Desktop before
                  relying on terminal commands.
                </p>
                <DataTable
                  headers={['Term', 'Plain-English meaning', 'Medical analogy']}
                  rows={gitRows}
                />
                <h3 className="mt-8 text-xl font-semibold tracking-tight">
                  The beginner GitHub workflow
                </h3>
                <StepList
                  steps={[
                    [
                      'Create a private repository',
                      'Use a short name, add a README, and add a license only when you are ready to share.',
                    ],
                    [
                      'Clone it locally',
                      'Use GitHub Desktop or the terminal. Open the folder in VS Code, Cursor, or Windsurf.',
                    ],
                    ['Build one feature', 'Add one page, one parser, one component, or one test.'],
                    [
                      'Review changed files',
                      'Read the diff. Ask the AI to explain anything you do not understand.',
                    ],
                    [
                      'Commit with a useful message',
                      'Example: Add EBUS station quiz with JSON question data.',
                    ],
                    [
                      'Push to GitHub',
                      'Now the checkpoint exists online and can be reviewed, deployed, or continued elsewhere.',
                    ],
                  ]}
                />
                <CodeBlock
                  label="Essential commands"
                  code={`# See what changed
git status

# Save all changed files into the next checkpoint
git add .

# Create the checkpoint
git commit -m "Add EBUS station quiz"

# Upload to GitHub
git push

# Create a safe branch for a new feature
git checkout -b add-tnm-module`}
                />
              </GuideSection>

              <GuideSection
                id="agents"
                kicker="7 - Agentic coding"
                title="How to use coding agents safely"
              >
                <p>
                  Agents are different from chatbots. A chatbot answers. An agent can inspect files,
                  edit files, run commands, and sometimes create pull requests. That power is why
                  agents are useful and why guardrails matter.
                </p>
                <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Use an agent when</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Checklist
                        items={[
                          'The project is already in GitHub or otherwise backed up.',
                          'You can describe a clear goal and success test.',
                          'The change spans multiple files.',
                          'You want tests, documentation, or refactoring.',
                          'You can review the diff before accepting changes.',
                        ]}
                      />
                    </CardContent>
                  </Card>
                  <Callout tone="danger" icon={ShieldCheck} className="m-0">
                    Do not use an agent on unreviewed PHI, production clinical systems without
                    approval, live databases, credential files, or anything where an accidental edit
                    could harm patients, leak data, or break operations.
                  </Callout>
                </div>
                <h3 className="mt-8 text-xl font-semibold tracking-tight">
                  The safest agent workflow
                </h3>
                <StepList
                  steps={[
                    [
                      'Start from a clean Git state',
                      'Run git status. Commit or stash current work.',
                    ],
                    ['Create a branch', 'Example: git checkout -b add-tnm-staging-module.'],
                    [
                      'Ask for a plan before edits',
                      'Tell the agent: Inspect the repo and propose a plan. Do not edit yet.',
                    ],
                    [
                      'Approve a small scope',
                      'Prefer one feature. Avoid rebuilding the entire app in one pass.',
                    ],
                    ['Run tests or build', 'Require npm run build, pytest, or whatever applies.'],
                    [
                      'Review the diff and summary',
                      'Ask for changed files, risks, assumptions, and manual test steps.',
                    ],
                  ]}
                />
                <CodeBlock
                  label="Agent prompt template"
                  code={`You are working in my GitHub repo for an educational interventional pulmonology app.

Goal: Add a TNM staging teaching module for pulmonary fellows.

Rules:
- Do not use or create any patient-identifiable data.
- Do not make changes until you inspect the repo and propose a short plan.
- Keep the first version small: reference cards, a simple staging builder, and 3 cases.
- Use existing styling and navigation patterns.
- Add or update tests if the project already has tests.
- Run the build command and report whether it passes.
- At the end, summarize changed files, assumptions, risks, and manual test steps.

Start by inspecting README.md, package.json, and the src folder. Then propose a plan.`}
                />
                <DataTable
                  headers={['Agent', 'Good use', 'How to think about it', 'Beginner guardrail']}
                  rows={agentRows}
                />
              </GuideSection>

              <GuideSection
                id="prompts"
                kicker="8 - Prompt library"
                title="Copy-ready prompts for clinicians"
              >
                <p>
                  The goal is not perfect wording. The goal is enough context for the assistant to
                  make good decisions.
                </p>
                <CardGrid columns="three">
                  {clearCards.map(([title, body]) => (
                    <InfoCard key={title} title={title} body={body} />
                  ))}
                </CardGrid>
                <CodeBlock
                  label="Planning prompt"
                  code={`I am a pulmonary/critical care physician building a beginner project with AI coding tools.

Clinical problem:
[Describe the problem]

Users:
[Medical students / fellows / research coordinator / attending / quality team]

Setting:
[Education only / research data / clinical workflow prototype]

Inputs:
[CSV, text notes, images, REDCap export, synthetic cases]

Outputs:
[Dashboard, quiz, parser output, report, PDF, table]

Constraints:
- Use de-identified or synthetic data only.
- Beginner-friendly stack.
- First version should be small and buildable in one weekend.

Please create:
1. A one-paragraph project summary.
2. MVP feature list.
3. Future feature backlog.
4. Recommended tech stack.
5. Data model.
6. Step-by-step build plan.
7. Risks and safety review checklist.`}
                />
                <CodeBlock
                  label="Debugging prompt"
                  code={`I am getting this error while running my app:

[Paste exact error]

Context:
- Tool/editor: [VS Code / Cursor / Claude Code / Codex]
- Command I ran: [npm run dev / python app.py / pytest]
- File I think is involved: [filename]
- What I expected: [expected behavior]
- What happened: [actual behavior]

Please:
1. Explain the error in beginner-friendly terms.
2. Identify the likely cause.
3. Give the smallest safe fix.
4. Tell me exactly which file to edit.
5. Suggest a test to confirm it is fixed.`}
                />
                <CodeBlock
                  label="Workbench pattern prompt"
                  code={`This is a visual/spatial problem and text iteration is not converging.

Please build a temporary workbench page that lets me manually adjust the values.
Requirements:
- Show the target image or object.
- Let me drag, resize, and nudge the hotspots, labels, or points.
- Show live coordinates and dimensions.
- Include a Copy JSON button.
- Store the temporary page in a clearly named route: /debug-hotspot-editor.
- Do not integrate into production yet.

After I paste the final JSON, help me wire it into the production component and remove the debug page.`}
                />
                <CodeBlock
                  label="Teaching app prompt"
                  code={`Build a React + Vite teaching app for EBUS nodal stations.

Audience: pulmonary fellows.
Purpose: rapid visual review before simulation lab.

Features:
1. Landing page with learning objectives.
2. Interactive station map with clickable stations 2R, 2L, 4R, 4L, 7, 10R/L, 11R/L.
3. Flashcard mode.
4. 15-question quiz with immediate feedback.
5. Case mode with 3 realistic staging cases.
6. Content stored in JSON files for easy editing.
7. Mobile-responsive layout.
8. Accessibility: keyboard navigation and alt text.
9. Disclaimer: educational use only.

Use synthetic cases only. Create the folder structure and starter components.`}
                />
              </GuideSection>

              <GuideSection
                id="projects"
                kicker="9 - Starter projects"
                title="Beginner projects that teach useful skills"
              >
                <DataTable
                  headers={['Project', 'Skills learned', 'Stack', 'Safety level']}
                  rows={projectRows}
                />
                <Callout tone="success" icon={CheckCircle2}>
                  Make an educational quiz or data dashboard first. It has real value, low risk, and
                  teaches the same building blocks you will need later: files, data, UI, testing,
                  GitHub, deployment, and user feedback.
                </Callout>
              </GuideSection>

              <GuideSection
                id="safety"
                kicker="10 - Safety and governance"
                title="Build responsibly"
              >
                <p>
                  Healthcare software has a different risk profile than a hobby app. Treat safety as
                  a design requirement, not a final checklist.
                </p>
                <CardGrid>
                  {safetyCards.map((card) => (
                    <InfoCard key={card.title} {...card} />
                  ))}
                </CardGrid>
                <h3 className="mt-8 text-xl font-semibold tracking-tight">Pre-share checklist</h3>
                <Checklist items={checklist} />
                <CodeBlock
                  label="Minimal .gitignore for clinician projects"
                  code={`.env
.env.*
*.key
*.pem
*.csv
*.xlsx
*.dcm
*.nii
*.nii.gz
patient_data/
exports/
logs/
node_modules/
__pycache__/
.DS_Store`}
                />
                <Callout tone="warning" icon={AlertTriangle}>
                  A file added to Git and later deleted can still remain in repository history. If
                  PHI or a secret is accidentally committed, stop and ask for help from someone who
                  knows Git history cleanup and institutional reporting requirements.
                </Callout>
              </GuideSection>

              <GuideSection
                id="learning-plan"
                kicker="11 - Learning pathway"
                title="A 30-day beginner plan for physicians"
              >
                <DataTable
                  headers={['Week', 'Goal', 'What to do', 'Deliverable']}
                  rows={learningRows}
                />
                <Callout tone="success" icon={CheckCircle2}>
                  Ship tiny. A finished 20-question EBUS quiz teaches more than an unfinished
                  mega-project. Useful beats impressive.
                </Callout>
              </GuideSection>

              <GuideSection
                id="resources"
                kicker="12 - Useful links"
                title="Curated links for clinician-builders"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {resourceGroups.map((group) => (
                    <Card key={group.title}>
                      <CardHeader>
                        <CardTitle className="text-lg">{group.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {group.links.map(([label, href]) => (
                            <li key={href}>
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                              >
                                {label}
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </GuideSection>

              <GuideSection id="glossary" kicker="13 - Glossary" title="Plain-English glossary">
                <DataTable headers={['Term', 'Meaning']} rows={glossaryRows} />
                <Callout tone="success" icon={CheckCircle2}>
                  The most important skill is not syntax. It is translating a clinical problem into
                  clear requirements, testing the result, and knowing when expert review is needed.
                </Callout>
              </GuideSection>

              <footer className="rounded-2xl border border-border/80 bg-muted/40 p-5 text-sm text-muted-foreground">
                <p>
                  Vibe Coding for Clinicians, Researchers, and Educators. Educational material only.
                  Not medical advice. Do not use with PHI unless your institution has approved
                  tools, agreements, workflows, and safeguards.
                </p>
              </footer>
            </article>
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function GuideSection({
  id,
  kicker,
  title,
  children,
}: {
  id: string
  kicker: string
  title: string
  children: ReactNode
}) {
  return (
    <HandoffContent>
      {
        <section id={id} className="scroll-mt-32 border-b border-border/80 pb-12 last:border-b-0">
          <div className="mb-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{kicker}</p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
          </div>
          <div className="space-y-5 text-base leading-7 text-muted-foreground">{children}</div>
        </section>
      }
    </HandoffContent>
  )
}

function CardGrid({
  children,
  columns = 'two',
}: {
  children: ReactNode
  columns?: 'two' | 'three'
}) {
  return (
    <HandoffContent>
      {
        <div
          className={cn(
            'grid gap-4',
            columns === 'three' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2',
          )}
        >
          {children}
        </div>
      }
    </HandoffContent>
  )
}

function InfoCard({
  label,
  title,
  body,
  href,
}: {
  label?: string
  title: string
  body: string
  href?: string
}) {
  return (
    <HandoffContent>
      {
        <Card className="h-full">
          <CardHeader>
            {label ? (
              <Badge variant="outline" className="w-fit rounded-full">
                {label}
              </Badge>
            ) : null}
            <CardTitle className="text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">{body}</p>
            {href ? (
              <Button asChild variant="link" className="h-auto justify-start p-0">
                <a href={href} target="_blank" rel="noreferrer">
                  Open resource
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      }
    </HandoffContent>
  )
}

function Callout({
  children,
  tone,
  icon: Icon,
  className,
}: {
  children: ReactNode
  tone: 'success' | 'warning' | 'danger'
  icon: typeof CheckCircle2
  className?: string
}) {
  const toneClass = {
    success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
    warning: 'border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100',
    danger: 'border-destructive/25 bg-destructive/10 text-destructive',
  }[tone]

  return (
    <HandoffContent>
      {
        <div
          className={cn(
            'flex gap-3 rounded-2xl border p-4 text-sm leading-6',
            toneClass,
            className,
          )}
        >
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>{children}</div>
        </div>
      }
    </HandoffContent>
  )
}

function StepList({ steps }: { steps: ReadonlyArray<readonly [string, string]> }) {
  return (
    <HandoffContent>
      {
        <ol className="grid gap-3">
          {steps.map(([title, body], index) => (
            <li
              key={title}
              className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 text-sm shadow-sm sm:grid-cols-[2.5rem_1fr]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span>
                <span className="block font-semibold text-foreground">{title}</span>
                <span className="mt-1 block leading-6 text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      }
    </HandoffContent>
  )
}

function DataTable({
  headers,
  rows,
}: {
  headers: readonly string[]
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>
}) {
  return (
    <HandoffContent>
      {
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {headers.map((header) => (
                  <th key={header} scope="col" className="px-4 py-3 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className={cn(
                        'px-4 py-3 text-muted-foreground',
                        cellIndex === 0 && 'font-medium text-foreground',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </HandoffContent>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <HandoffContent>
      {
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            <Code2 className="h-4 w-4" aria-hidden />
            {label}
          </div>
          <pre className="overflow-x-auto p-4 text-sm leading-6 text-slate-100">
            <code>{code}</code>
          </pre>
        </div>
      }
    </HandoffContent>
  )
}

function Checklist({ items }: { items: readonly string[] }) {
  return (
    <HandoffContent>
      {
        <ul className="grid gap-2 text-sm">
          {items.map((item) => (
            <li key={item} className="flex gap-2 leading-6 text-muted-foreground">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      }
    </HandoffContent>
  )
}

function TwoColumnList({
  leftTitle,
  leftItems,
  rightTitle,
  rightItems,
}: {
  leftTitle: string
  leftItems: readonly string[]
  rightTitle: string
  rightItems: readonly string[]
}) {
  return (
    <HandoffContent>
      {
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" aria-hidden />
                {leftTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Checklist items={leftItems} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListChecks className="h-5 w-5 text-primary" aria-hidden />
                {rightTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Checklist items={rightItems} />
            </CardContent>
          </Card>
        </div>
      }
    </HandoffContent>
  )
}
