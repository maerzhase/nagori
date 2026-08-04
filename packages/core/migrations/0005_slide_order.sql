-- An order the family sets, not a way of looking at the list.
--
-- The frame played newest-first and the dashboard let you re-sort your own view,
-- which are two different things: neither let anyone say what comes after what.
-- `position` is that order, and the manifest is sorted by it, so the library
-- always shows the sequence the frame is actually playing.
--
-- Seeded from the existing newest-first order so nothing appears to move.
ALTER TABLE slides ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

UPDATE slides
SET position = (
  SELECT COUNT(*)
  FROM slides AS earlier
  WHERE earlier.household_id = slides.household_id
    AND (
      earlier.created_at > slides.created_at
      OR (earlier.created_at = slides.created_at AND earlier.id > slides.id)
    )
);

CREATE INDEX IF NOT EXISTS slides_position_idx
  ON slides (household_id, position);
