---
name: semantic-gap-engine
description: >
  Use this skill to compare a single required skill with a single candidate skill
  and determine whether the candidate skill satisfies, partially satisfies,
  or does not satisfy the requirement.

  This skill is domain-agnostic and must work across technical and non-technical roles.

  It MUST NOT perform aggregation, scoring, or decision-making.
  It only performs pairwise semantic comparison.

---

# Semantic Skill Matching

## Purpose

Given:
- one required skill
- one candidate skill

Determine:
- whether the candidate skill satisfies the requirement
- the strength of that match

This is used by the Gap Engine (Layer 2) to compute coverage.

---

## Rules

1. Be **strict but fair**:
   - Do not assume equivalence unless there is a clear relationship.
   - Avoid optimistic matching.

2. Handle:
   - direct matches (exact same skill)
   - close equivalents (framework vs language, tool vs category)
   - broader/narrower relationships

3. Domain-agnostic:
   - Must work for IT, marketing, finance, healthcare, etc.

4. No guessing beyond reasonable inference:
   - If unsure → return "none"

5. NEVER:
   - compute coverage
   - compare multiple skills at once
   - make application decisions

---

## Input

```json
{
  "requiredSkill": "string",
  "candidateSkill": "string"
}