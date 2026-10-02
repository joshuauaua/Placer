# Placer — Product Requirements Document

Version 1.0

## Overview & Objectives

### Product Vision

Placer will be **the** definitive digital platform connecting citizens, urban practitioners, and city leaders to collectively reimagine and shape their cities.

### Strategic Goals

- **For Citizens:** Empower residents with intuitive spatial visualization tools to easily share and communicate urban improvement ideas.
- **For Practitioners:** Equip placemakers with a unified digital toolkit to plan, facilitate, and execute community projects efficiently.
- **For City Officials:** Bridge local government and community insights through real-time citizen feedback and direct communication channels.

## Target Users & Use Cases

### User persona 1: Citizen

**Pain points:**

1. Wants change in local environment but lacks a channel to effectively communicate their idea
2. Wants to build momentum around a challenge in the city and find others who resonate, start a conversation around a problem or challenge that they face in the city

**Real-world Scenarios:**

1. **Highlighting a Local Need:** Safija notices a dangerous, underutilized street corner in their neighborhood. Using the app on mobile browser, Safija takes a Google Street View screenshot, overlays benches, greenery, and a bike rack to create an "Imagination," and posts it to the local map to gather community support.
2. **Finding Community Consensus:** Safija wants to see if neighbors also want a local community garden. They create an "Imagination," tag it under "Green Spaces," and share the link in local chat groups to collect upvotes and constructive feedback.

### User persona 2: Practitioner

**Pain points:**

1. Requires a centralised platform to be able to document, share and invite others to interact in their placemaking projects
2. Working with paper and analog methods, while having its benefits, also has its drawbacks.
   1. Answers need to be digitised
   2. Papers can be messy
   3. Connecting participants answers, opinions, surveys, articles and research on a clear and centralised project page typically takes a lot of work

**Real-world Scenarios:**

1. **Digitizing On-Site Workshops:** Gabriel runs a neighborhood co-design workshop using paper maps. Afterward, instead of manually compiling paper notes into a lengthy report, he uses a Toolkit tool to digitize participant inputs directly into a public Project page.
2. **Project Centralization:** Gabriel needs a single hub to keep residents updated on a 6-month plaza redesign. He sets up a public Project page containing background resources, live Toolkit results, linked research articles, and a feed of citizen-submitted Imaginations.

### User persona 3: Municipality

**Pain points:**

1. Working with citizens is a challenge because they represent a decentralised, often unstructured, sometimes contrasting and fragmented voice
2. Understanding citizen sentiment can also be a challenge when there is a lack of platform for this
3. Communicating upcoming projects and ongoing works is also a challenge in the limited official communication channels

**Real-world Scenarios:**

1. **Aggregating Public Sentiment:** An urban planner, Sultan, wants to understand what residents envision for an upcoming park redevelopment. He checks the city map filter for "Imaginations" in that neighborhood to see top-voted ideas and trending themes.
2. **Targeted News & Updates:** Sultan wants to notify local residents about an upcoming public consultation meeting regarding road re-paving. He posts an official update news link to the relevant Project page to reach interested citizens directly.

## Specific Features

### Profile

- **Profile Name:** Manage display name.
- **Profile Bio:** Manage personal description (optional).
- **Profile Location:** Manage location details (optional).
- **Profile Avatar:** Select an icon or avatar from a predefined library.
- **Created Imaginations:** View self-created spatial visualisations.
- **Followed Projects:** View bookmarked projects.
- **Followed Cities:** View followed geographic locations.
- **Followed Users:** View followed profiles.
- **Followed Imaginations:** View saved visualisations.

### Settings

- **Profile Configuration:** Update profile details and preferences.
- **Account Deletion:** Permanently delete profile and account data.
- **Data Management:** Download or delete personal platform data.

### Resources

- **Resource Contribution:** Submit new resource materials via form.
- **Resource Access:** Read/view available educational and reference materials.

### Map

- **Map Exploration:** Browse public spatial visualisations, projects, and city activity globally or by region.
- **Spatial Filtering:** Filter map pins by category, project, city, or date.
- **Location Pinning:** Click map locations to view associated citizen Imaginations and active Projects.

### Imaginations

- **Imagination Creation:** Create spatial visualisations by overlaying assets onto Google Street View screenshots.
- **Imagination Metadata:** Add title, description, and category tags to visualisations.
- **Map Publishing:** Post completed visualisations to the public interactive map.
- **Community Engagement:** Comment on and vote for visualisations on the public map.

### Follow

- **Follow Imagination:** Track updates and activity on specific visualisations.
- **Follow User:** Subscribe to activity from other profile owners.
- **Follow City:** Track placemaking updates within a specific geographic location.
- **Follow Project:** Receive updates on practitioner-led projects.

### Projects

- **Project Creation:** Enable practitioners to launch and manage public projects.
- **Project Setup:** Define start and end dates, geographic locations, descriptions (goals), and publishers/collaborators.
- **Documentation Sharing:** Attach external news articles, links, and supporting web resources (links only, no file uploads).
- **Project Dashboard:** Access internal analytics, including interaction metrics and engagement stats.
- **Toolkit Access:** Unlock embedded interactive placemaking tools upon project creation.
- **Public Project Page:** Display an external-facing page showing citizen imaginations, toolkit activities, results, and project news.

### Toolkit

- **Interactive Toolset:** Access a collection of open-source placemaking methods converted into interactive web apps.
- **Collaboration Modes:** Utilize tools in solo mode (individual practitioner) or multiplayer mode (practitioners, citizens, and city officials).
- **Results Archiving:** Save output and activity logs directly to the associated Project Dashboard.
- **Tool Publishing:** Deploy native PLACER tools or practitioner-submitted tools (direct or consent-based).
- **Technical Workshops:** Book or attend workshops on converting static placemaking PDFs into live interactive web applications.

### Notifications

- **Engagement Alerts:** Receive updates when users comment on or vote for your Imaginations.
- **Activity Alerts:** Receive updates when followed Projects, Cities, or Users post news or new Toolkit results.
- **Follower Alerts:** Receive updates when a user follows your profile.
- **System Alerts:** Receive platform announcements and account maintenance notifications.

## User Stories

### Citizen

- US-01: As a Citizen, I want to capture a Google Street View scene and place visual assets on top of it, so that I can visually express how I want a public space reimagined.
- US-02: As a Citizen, I want to upvote and comment on other residents' Imaginations on a public map, so that I can show support for local ideas I agree with.
- US-03: As a Citizen, I want to follow specific cities, projects, and practitioners, so that I get notified when new updates or consultations are posted.

### Practitioner

- US-04: As a Practitioner, I want to create a public Project page with geographic boundaries, dates, and supporting links, so that I can centralize all engagement efforts in one place.
- US-05: As a Practitioner, I want to run multiplayer Toolkit tool sessions with community members, so that we can collaboratively run placemaking exercises digitally.
- US-06: As a Practitioner, I want access to a project analytics dashboard (tracking votes, interactions, and participant counts), so that I can report engagement impact to stakeholders.

### Municipality

- US-07: As a City Official, I want to filter citizen Imaginations by geographic area and category, so that I can understand neighborhood-specific needs during planning phases.
- US-08: As a City Official, I want to attach official updates and links to existing community projects, so that citizens have verified information regarding city plans.

## How the System Should Respond (System Behavior)

1. **Spatial Asset Rendering:** When a user creates an Imagination, the canvas must lock the Google Street View frame orientation and allow drag-and-drop layering of vector assets with basic scaling and deletion controls.
2. **Public Map Geocoding:** Publishing an Imagination pins the object to the exact latitude/longitude of the Street View capture, instantly rendering it visible on the global interactive map.
3. **Multiplayer Synchronization:** When running a multiplayer Toolkit session, asset placements and input state changes must synchronize across all participants in under 500ms (real-time state management).
4. **Content Moderation:** If an Imagination or comment receives 3 or more user reports, the system automatically flags the content and hides it pending moderator review.
5. **Data Export:** When a user clicks "Download Data" under Settings, the system compiles their profile info, created Imaginations, and comments into a downloadable .zip (JSON + images) within 24 hours.

## Non-Functional Requirements

### Performance

- **Page Load Time:** Interactive map and street view canvas must load in under 2.5 seconds on standard 4G connections.
- **Real-time Latency:** Multi-user Toolkit interactions must sync with <500ms latency.

### Usability & Accessibility

- **Web & Mobile Friendly:** Fully responsive web application optimized for desktop and mobile browsers.
- **Accessibility:** Web Content Accessibility Guidelines (WCAG 2.1 AA) compliance for UI contrast, keyboard navigation, and screen readers.

### Security & Privacy

- **GDPR Compliance:** Full adherence to EU + US + Turkish data protection rules (explicit consent, right to be forgotten, data portability).
- **Authentication:** Secure user sign-up/login via email or OAuth (Google, Apple).
- **Data Isolation:** Internal project analytics and participant draft data must be logically isolated per project owner.

### Reliability & Scalability

- **Uptime:** 99.5% service availability.
- **Scalability:** Architecture must support up to 1,000 concurrent active users on the interactive map without degradation.

## Scope

### In-Scope (Phase 1 / MVP)

- Web app platform (Desktop + Mobile browser).
- User authentication and Profile management (4 library avatars).
- 2D spatial canvas overlay tool built on top of Google Street View screenshots.
- Interactive Public Map displaying Imaginations and Projects.
- Practitioner Project Creation & Public Project Pages (link-only documentation).
- Standard Project Dashboard (basic analytics: views, votes, comments).
- 2 pre-built interactive web Toolkit tools (solo & multiplayer modes).
- Notification center (in-app notifications).

### Out-of-Scope (Deferred to Future Releases)

- Native mobile applications (iOS / Android app stores).
- 3D spatial rendering / AR (Augmented Reality) view mode.
- Direct file upload/hosting for project documentation (e.g., hosting large PDFs directly; Phase 1 uses external links only).
- In-app direct messaging between users (communication restricted to public comments).
- Custom avatar uploads.
- Native automated translation of project pages.

## Assumptions & Dependencies

### Technical Dependencies

- Google Maps / Street View API: Relies on third-party API stability, licensing, and image coverage quality.
- WebSockets / Real-time Infrastructure: Required to support multiplayer Toolkit tools smoothly.

### Operational & Business Assumptions

- Practitioner Adoption: Assumes practitioners are willing to transition from pure analog methods to hybrid/digital placemaking toolkits.
- Community Moderation: Assumes initial community moderation can be handled by platform administrators and project owners without complex automated AI moderation tools.
- Legal / Permitting Disclaimer: Imaginations are purely conceptual urban visions and do not constitute formal architectural blue-prints or official municipal permit submissions.

## Success Metrics

Success metrics outlined in project proposal (in “Deliverables” file).
