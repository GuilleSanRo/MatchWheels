## Goal
Remove the two decorative marks from the header so the title block stands alone.

## Changes
1. **`src/routes/index.tsx`** — delete the small "Sparkles" badge `<div>` (the pill containing the 3-star icon) above the title.
2. **`src/components/MatchWheelsLogo.tsx`** — in `MatchWheelsTitle`, remove the circular logo mark (fire + wheel) rendered to the left of the title, keeping only the text "MatchWheels: From Pricer to Shopper" and the "Matrix MSRP Updater" subtitle.

## Result
Header becomes a clean, text-only block with no icons or badges — fully aligned with the minimalist direction.