# Product spec — SoCal EBUS Prep web app (v1)

## Product goal
Build an offline-first web learning app that prepares learners for the Southern California EBUS course.

## Audience
- Pulmonary fellows
- Interventional pulmonology trainees
- Learners preparing for EBUS hands-on training

## Core product principles
- Fast to open and usable in the bronchoscopy suite or the day before course
- Image-first and interactive, not a slide dump
- Single web codebase
- Offline-first for all teaching modules in v1
- Educational only; not a medical device; no patient-specific guidance

## Top three modules for v1

### 1) Ultrasound Foundations + EBUS Knobology
Purpose:
Teach the learner what each control does and how to correct a poor image.

Learning goals:
- Understand depth, gain, contrast, color Doppler, calipers, freeze, and save
- Recognize common beginner errors
- Practice “fix the image” tasks
- Understand vessel detection at a basic level

Required screens:
- Primer screen
- Control lab / simulator screen
- Doppler mini-lab
- Quick-reference card screen
- Quiz screen

### 2) Mediastinal Station Map
Purpose:
Give the learner a fast way to memorize station names, zones, borders, and common access patterns.

Learning goals:
- Recognize IASLC station groups
- Identify core staging stations
- Review anatomic borders and drainage concepts
- Drill station naming with repetition

Required screens:
- Zoomable station map
- Station detail sheet
- Flashcard mode
- Pin-the-station quiz
- Review summary screen

### 3) CT ↔ Bronchoscopic ↔ Ultrasound Station Explorer
Purpose:
Help the learner connect the same station across three views.

Learning goals:
- Map a station from CT to airway to EBUS appearance
- Learn the most useful landmark relationships
- Practice station recognition using multiple representations

Required screens:
- Station selector
- Correlated tri-view explorer
- Landmark checklist
- “Name that station” challenge
- Mastery summary screen

## Navigation
- Home
- Modules
- Progress
- Quick Review
- Settings

## Progress tracking
Store locally in v1:
- module completion
- quiz scores
- last viewed station
- bookmarked stations/cards

## Data strategy
- Content must live outside UI code in JSON/Markdown files
- Each station should have a structured content object
- Each module should support later content replacement without component rewrites

## Asset strategy
- Use placeholders initially
- Keep asset filenames stable
- Support later replacement with higher-fidelity images or illustrations

## Non-goals for v1
- DICOM viewer
- Cloud sync
- CME tracking
- Admin CMS
- Social features
- 3D airway rendering
- Real-time ultrasound physics simulation

## Accessibility and UX requirements
- Large tap targets
- Responsive layouts for desktop and tablet down to mobile widths
- Keyboard and screen-reader labels on interactive controls
- Color should not be the sole carrier of information
- Support a polished default light mode first; add dark mode only when it does not slow core delivery

## Definition of done
- App builds and runs in the browser
- All three modules are reachable from the home screen
- Content is loaded from local files
- Progress persists across app restarts
- Basic tests pass
- No PHI, patient-specific data, or copyrighted slide screenshots are bundled
