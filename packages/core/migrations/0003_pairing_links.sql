-- A frame can be connected two ways, with deliberately different lifetimes.
--
-- The six-digit code is typed on the iPad, so it has to stay short, and a short
-- secret has to expire quickly: /api/pair allows 10 attempts per IP per 15
-- minutes against a 1,000,000-wide space.
--
-- A link is clicked, not typed, so it carries a 128-bit token instead and needs
-- no short window. That matters because the frame is the recipient's entry
-- point: a link that dies before they open it means sending another one.
--
-- Both claim the same device row, and both stay single-use.
ALTER TABLE devices ADD COLUMN pair_link_hash TEXT;
ALTER TABLE devices ADD COLUMN pair_link_expires_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS devices_pair_link_hash
  ON devices (pair_link_hash);
