# TechCrunch-Style News Homepage Design

## Goal

Turn the public homepage into a recognizable technology news website. Use a TechCrunch-class information architecture while preserving The New AI Times newspaper identity and the existing recommendation system.

The current homepage mixes public news reading with newsroom and recommendation analysis. Labels such as Front Page Layout, Slot Mix, Source Clusters, Claim Tracker, Story Timeline, and Consensus Board make the page feel like an internal system rather than a publication.

## Design Direction

- Latest headlines on the left, a dominant lead story in the center, and most-read stories on the right.
- Newspaper masthead, serif display headlines, black-and-white foundation, and restrained dark-red accents.
- High editorial density with low motion.

## Public Homepage Structure

The compact masthead contains the publication name, edition date and state, search, Reader Center access, and the existing theme behavior. A single-line channel row exposes Latest, Models, Agents, Startups, Research, Funding, and Security.

The first desktop viewport uses three columns: five compact Latest headlines, one dominant A1 story, and a numbered Most Read list with a compact For You entry. Mobile orders these as A1, Latest, then Most Read.

Editor's Picks replaces the Briefing Pack presentation with three or four normal news cards selected for source trust, recency, and channel variety. The main body is a chronological Latest News stream with a 4:3 visual, category, headline, two-line summary, source, time, and Save, Less, and Share actions. It initially shows approximately 15 to 20 stories and keeps the existing Load More behavior.

For You remains a first-class feed mode but is visually subordinate to the public edition. Recommendation reasons appear only on dedicated reader surfaces.

## Removed From The Homepage

The public homepage no longer renders or computes Front Page Layout, Slot Mix, Source Clusters, Claim Tracker, Story Timeline, multi-source cluster analysis, Consensus Board, or recommendation diagnostics. Story-specific analysis belongs on article pages, multi-source coverage belongs in Threads, and ranking transparency belongs in Recommendation Lab.

## Visual And Responsive System

The page uses white newsprint in light mode and near-black in dark mode, near-black or near-white text, dark editorial red accents, serif display headlines, square or minimally rounded corners, and thin divider rules. Existing story images are used at stable 16:9 and 4:3 ratios. Missing images render a deliberate source/category fallback with accessible text.

Desktop at 1024px and above uses the three-column first viewport. Tablet keeps the lead dominant and balances the secondary columns. Mobile below 768px orders lead, Latest, Most Read, Editor's Picks, and Latest News. Navigation may scroll horizontally, and all actions remain touch accessible.

## Data And Architecture

All sections derive from existing live news and ranking data. A1 uses the highest-ranked current story, Latest sorts by publication time, Most Read uses existing trend and interaction signals without fabricated counts, and Editor's Picks favors current high-trust stories with source/category variety. One exclusion set prevents duplication across the first-viewport groups.

`NewsHome` remains the client controller for visitor identity, profile hydration, tRPC, actions, feed mode, pagination, and exposure memory. A focused public view owns the publication layout and receives prepared story groups and callbacks. No database or migration change is required.

## States, Accessibility, And Language

Preview Edition remains the database-unavailable fallback. Latest remains usable if recommendations fail. Missing candidates produce smaller sections rather than duplicates. Image and row dimensions remain reserved while loading, and an exhausted feed has a clear end state.

The view uses semantic header, nav, main, section, article, ordered-list, and heading structure. Icon controls have labels and tooltips, focus states remain visible, and active modes are not indicated by color alone. Existing English-string conventions remain because the repository has no configured Lingui catalog; this redesign does not regenerate i18n files.

## Acceptance Criteria

- The first viewport reads immediately as a technology news publication.
- It contains one lead story, Latest headlines, and Most Read stories with no duplicates.
- Editor's Picks leads directly into a chronological Latest News stream.
- Public-home text contains no newsroom-layout or recommendation-diagnostic terminology.
- Save, Less, Share, search, reader memory, Latest / For You, and pagination continue to work.
- Desktop, tablet, mobile, light, dark, and missing-image states render without overlap or horizontal page overflow.
- Next.js tests, typecheck, lint, production build, and `git diff --check` pass.
