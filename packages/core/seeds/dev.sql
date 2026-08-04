-- Development fixture. Local only — `pnpm db:seed:local`.
--
-- Every id and date is derived, so re-running produces the same state: the same
-- login, the same rotation in the same order, and one of every row a screen can
-- show (a pending invite, a frame waiting to connect, a slide that has expired).
-- Without it, exercising any of those states means hand-writing SQL, and the
-- password of a hand-made account is gone the moment you forget it.
--
-- The credentials below are checked by packages/core/tests/dev-seed.test.ts.
-- PBKDF2 parameters are implicit in the stored hash, so if they ever change that
-- test fails rather than dev login quietly breaking.
--
-- SEED_EMAIL: owner@nagori.test
-- SEED_PASSWORD: nagori-dev-owner
-- SEED_SALT: 0123456789abcdef0123456789abcdef
-- SEED_HASH: 6833eb1ef4a9495fae1f3a41a6e3c7da443951c9b0acbc814faf5ff1c74ec8e5

DELETE FROM audit_events;
DELETE FROM slides;
DELETE FROM media_assets;
DELETE FROM devices;
DELETE FROM invitations;
DELETE FROM sessions;
DELETE FROM viewer_settings;
DELETE FROM memberships;
DELETE FROM households;
DELETE FROM users;
DELETE FROM login_attempts;
DELETE FROM request_limits;

INSERT INTO users (id, email, name, password_hash, password_salt, created_at)
VALUES
  ('usr_dev_owner', 'owner@nagori.test', 'Dev Owner',
   '6833eb1ef4a9495fae1f3a41a6e3c7da443951c9b0acbc814faf5ff1c74ec8e5',
   '0123456789abcdef0123456789abcdef',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Same password, so you can sign in as a non-owner and see the reduced UI.
  ('usr_dev_editor', 'editor@nagori.test', 'Dev Editor',
   '6833eb1ef4a9495fae1f3a41a6e3c7da443951c9b0acbc814faf5ff1c74ec8e5',
   '0123456789abcdef0123456789abcdef',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO households (id, name, timezone, playlist_revision, created_at)
VALUES ('home_dev', 'Nagori dev family', 'Europe/Lisbon', 1,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO memberships (household_id, user_id, role, created_at)
VALUES
  ('home_dev', 'usr_dev_owner', 'owner', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('home_dev', 'usr_dev_editor', 'editor', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO viewer_settings (household_id) VALUES ('home_dev');

-- Three in the rotation, in a deliberate order, so reordering has something to
-- move and each message theme is on screen.
INSERT INTO slides (id, household_id, kind, message, theme, state, display_from,
                    display_until, position, created_by, created_at, updated_at)
VALUES
  ('slide_dev_1', 'home_dev', 'message', 'Good morning from all of us.', 'paper',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+28 days'), 0, 'usr_dev_owner',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')),
  ('slide_dev_2', 'home_dev', 'message', 'Thinking of you both today.', 'sunset',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'),
   NULL, 1, 'usr_dev_editor',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')),
  ('slide_dev_3', 'home_dev', 'message', 'See you on Sunday!', 'garden',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+5 days'), 2, 'usr_dev_editor',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')),
  -- Not started yet: shows under "Coming up".
  ('slide_dev_upcoming', 'home_dev', 'message', 'Happy birthday, Oma!', 'sunset',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+14 days'), 3, 'usr_dev_owner',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Already over: shows under "Ready to archive".
  ('slide_dev_expired', 'home_dev', 'message', 'Thanks for a lovely visit.',
   'paper', 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-40 days'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days'), 4, 'usr_dev_owner',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-40 days'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-40 days'));

-- One connected frame and one still waiting, so the Frames tab shows both
-- states. Neither secret is usable: only hashes are stored, and these are not
-- hashes of anything. Use "New link" to get a link that works.
INSERT INTO devices (id, household_id, name, token_hash, last_seen_at,
                     pair_link_hash, pair_link_expires_at, created_at)
VALUES
  ('dev_dev_paired', 'home_dev', 'Grandparents'' iPad',
   'seed-not-a-real-token-hash', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour'),
   NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 days')),
  ('dev_dev_waiting', 'home_dev', 'Kitchen iPad', NULL, NULL,
   'seed-not-a-real-link-hash', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 days'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'));

-- A pending invite, for the Family tab's rotate/cancel row.
INSERT INTO invitations (id, household_id, email, role, token_hash, expires_at,
                        created_by, created_at)
VALUES ('inv_dev_pending', 'home_dev', 'aunt@nagori.test', 'editor',
        'seed-not-a-real-invite-hash',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days'), 'usr_dev_owner',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
