-- How a photo sits in the frame.
--
-- `fit_mode` already chose between showing the whole photo and filling the
-- screen. What was missing is *which part* survives a fill: a group photo
-- cropped to its centre can lose the faces along the top edge.
--
-- Both settings become per-slide overrides as well as household defaults,
-- because the right crop is a property of the photo, not of the frame. NULL on
-- a slide means "use the household setting".
ALTER TABLE viewer_settings ADD COLUMN focal_point TEXT NOT NULL DEFAULT 'center'
  CHECK(focal_point IN ('center', 'top', 'bottom', 'left', 'right'));

ALTER TABLE slides ADD COLUMN fit_mode TEXT
  CHECK(fit_mode IS NULL OR fit_mode IN ('contain', 'cover'));
ALTER TABLE slides ADD COLUMN focal_point TEXT
  CHECK(focal_point IS NULL OR focal_point IN ('center', 'top', 'bottom', 'left', 'right'));
