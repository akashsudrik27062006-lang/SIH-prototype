# LabelGuard Development Guide

LabelGuard is the existing SIH 2026 (SIH26034) project for Legal Metrology packaged-commodity compliance. Build on this repository; do not rebuild it from scratch.

## Working rules

- Preserve the existing custom CSS. Do not convert the project to Tailwind.
- Do not redesign the existing UI unless explicitly requested. Reuse working components and work incrementally.
- Never remove a feature without explaining why and recording the decision.
- Read `docs/` and `progress/`, then inspect Git status and recent history before continuing work in a new session.
- Run the appropriate build/type checks after meaningful changes.
- Keep Git checkpoints after completed milestones.
- Do not begin Supabase, OCR, Gemini, or other backend work until the applicable milestone authorizes it.

## Compliance principle

AI is not the final legal authority. AI extracts information and can produce potential findings. Deterministic rules validate requirements. A human/authorized Legal Metrology Officer must verify enforcement decisions.

