# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a planning/research repository for an **ADA/WCAG Compliance Testing Tool** - a web accessibility testing solution targeting SMBs, e-commerce sites, and agencies. The project is in the early research and planning phase.

## Project Goals

Build a testing tool (NOT an overlay/widget) using:
- **axe-core** - Primary WCAG testing engine from Deque Systems
- **Pa11y** - CLI tool combining axe-core + HTML CodeSniffer
- **Node.js** - Backend technology
- CI/CD integration with GitHub Actions, GitLab CI

Key positioning: Honest, transparent testing tool that doesn't overpromise (automated tools detect ~30% of WCAG issues).

## Repository Structure

```
docs/
├── analysis/          # Market research and validation reports (EN/VI)
├── blueprints/        # Technical design documents (empty - to be created)
└── requirements/      # Product requirements (empty - to be created)
```

## Target Standards

- WCAG 2.0, 2.1, 2.2 (Levels A, AA, AAA)
- ADA Title II/III compliance (US)
- EN 301 549 / EAA compliance (Europe)
- AODA/ACA (Canada)

## Key Deadlines Driving Development

- **June 2025**: EAA (European Accessibility Act) already in effect
- **April 2026**: ADA Title II deadline for US local governments >50k population
- **April 2027**: ADA Title II deadline for US local governments <50k population

## Target Markets (Priority Order)

1. USA (largest market, most lawsuits)
2. EU (27 countries, EAA penalties up to €3M)
3. UK (Equality Act 2010)
4. Canada (AODA, fines up to CAD 100k/day)

## Target Customers

- SMBs and E-commerce (77% of accessibility lawsuits)
- Web development agencies
- Local governments and school districts
- Healthcare organizations
