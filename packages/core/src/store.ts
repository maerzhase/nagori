import {
  ACTIVE_SLIDE_LIMIT,
  defaultSchedule,
  isValidScheduleWindow,
} from "./schedule";
import { randomId, sha256 } from "./security";
import type {
  Database,
  Role,
  SessionUser,
  ViewerManifest,
  ViewerSettings,
  ViewerSlide,
} from "./types";

interface SessionRow extends SessionUser {
  expiresAt: string;
}

export interface SlideRow {
  id: string;
  kind: "photo" | "message";
  caption: string | null;
  message: string | null;
  theme: string;
  state: "draft" | "published" | "archived";
  displayFrom: string;
  displayUntil: string | null;
  createdAt: string;
  mediaType: string | null;
  r2Key: string | null;
}

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface DeviceRow {
  id: string;
  name: string;
  lastSeenAt: string | null;
  createdAt: string;
  paired: number;
}

export class NagoriStore {
  constructor(private readonly db: Database) {}

  async isLoginLocked(email: string): Promise<boolean> {
    const attempt = await this.db
      .prepare(
        "SELECT locked_until AS lockedUntil FROM login_attempts WHERE email_hash = ?",
      )
      .bind(await sha256(email))
      .first<{ lockedUntil: string | null }>();
    return Boolean(
      attempt?.lockedUntil &&
        new Date(attempt.lockedUntil).getTime() > Date.now(),
    );
  }

  async recordFailedLogin(email: string): Promise<void> {
    const key = await sha256(email);
    const now = new Date();
    const existing = await this.db
      .prepare(
        "SELECT failures, window_started_at AS windowStartedAt FROM login_attempts WHERE email_hash = ?",
      )
      .bind(key)
      .first<{ failures: number; windowStartedAt: string }>();
    const withinWindow =
      existing &&
      now.getTime() - new Date(existing.windowStartedAt).getTime() <
        15 * 60_000;
    const failures = withinWindow ? existing.failures + 1 : 1;
    const lockedUntil =
      failures >= 5
        ? new Date(now.getTime() + 15 * 60_000).toISOString()
        : null;
    await this.db
      .prepare(
        "INSERT INTO login_attempts (email_hash, failures, window_started_at, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(email_hash) DO UPDATE SET failures = excluded.failures, window_started_at = excluded.window_started_at, locked_until = excluded.locked_until",
      )
      .bind(
        key,
        failures,
        withinWindow ? existing.windowStartedAt : now.toISOString(),
        lockedUntil,
      )
      .run();
  }

  async clearFailedLogins(email: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM login_attempts WHERE email_hash = ?")
      .bind(await sha256(email))
      .run();
  }

  async consumeRateLimit(input: {
    scope: string;
    identifier: string;
    maxAttempts: number;
    windowMs: number;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const key = await sha256(`${input.scope}:${input.identifier}`);
    const now = new Date();
    const existing = await this.db
      .prepare(
        "SELECT attempts, reset_at AS resetAt FROM request_limits WHERE key_hash = ?",
      )
      .bind(key)
      .first<{ attempts: number; resetAt: string }>();
    const keepWindow =
      existing && new Date(existing.resetAt).getTime() > now.getTime();
    const resetAt = keepWindow
      ? new Date(existing.resetAt)
      : new Date(now.getTime() + input.windowMs);
    const attempts = keepWindow ? existing.attempts + 1 : 1;
    const allowed = attempts <= input.maxAttempts;
    await this.db
      .prepare(
        "INSERT INTO request_limits (key_hash, attempts, reset_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET attempts = excluded.attempts, reset_at = excluded.reset_at, updated_at = excluded.updated_at",
      )
      .bind(
        key,
        attempts,
        resetAt.toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    return {
      allowed,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  async hasUsers(): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS count FROM users")
      .first<{ count: number }>();
    return Number(row?.count ?? 0) > 0;
  }

  async createOwner(input: {
    email: string;
    name: string;
    passwordHash: string;
    passwordSalt: string;
    householdName: string;
    timezone: string;
  }): Promise<{ userId: string; householdId: string }> {
    const now = new Date().toISOString();
    const userId = randomId("usr");
    const householdId = randomId("home");
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          userId,
          input.email,
          input.name,
          input.passwordHash,
          input.passwordSalt,
          now,
        ),
      this.db
        .prepare(
          "INSERT INTO households (id, name, timezone, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(householdId, input.householdName, input.timezone, now),
      this.db
        .prepare(
          "INSERT INTO memberships (household_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
        )
        .bind(householdId, userId, now),
      this.db
        .prepare("INSERT INTO viewer_settings (household_id) VALUES (?)")
        .bind(householdId),
      this.db
        .prepare(
          "INSERT INTO audit_events (id, household_id, actor_user_id, action, subject_id, created_at) VALUES (?, ?, ?, 'household.created', ?, ?)",
        )
        .bind(randomId("evt"), householdId, userId, householdId, now),
    ]);
    return { userId, householdId };
  }

  async findPasswordUser(email: string) {
    return this.db
      .prepare(
        "SELECT id, email, name, password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE email = ?",
      )
      .bind(email)
      .first<{
        id: string;
        email: string;
        name: string;
        passwordHash: string;
        passwordSalt: string;
      }>();
  }

  async listMembers(householdId: string): Promise<MemberRow[]> {
    const result = await this.db
      .prepare(`
      SELECT u.id, u.name, u.email, m.role FROM memberships m
      JOIN users u ON u.id = m.user_id WHERE m.household_id = ? ORDER BY m.created_at
    `)
      .bind(householdId)
      .all<MemberRow>();
    return result.results ?? [];
  }

  async createInvitation(input: {
    householdId: string;
    userId: string;
    email: string;
    role: Role;
  }) {
    const token = randomId("invite");
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 86400000);
    await this.db
      .prepare(
        "INSERT INTO invitations (id, household_id, email, role, token_hash, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        randomId("inv"),
        input.householdId,
        input.email,
        input.role,
        await sha256(token),
        expires.toISOString(),
        input.userId,
        now.toISOString(),
      )
      .run();
    return token;
  }

  async getInvitation(token: string) {
    return this.db
      .prepare(`
      SELECT i.id, i.household_id AS householdId, i.email, i.role, i.expires_at AS expiresAt, h.name AS householdName
      FROM invitations i JOIN households h ON h.id = i.household_id
      WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > ?
    `)
      .bind(await sha256(token), new Date().toISOString())
      .first<{
        id: string;
        householdId: string;
        email: string;
        role: Role;
        expiresAt: string;
        householdName: string;
      }>();
  }

  async acceptInvitation(input: {
    token: string;
    name: string;
    passwordHash: string;
    passwordSalt: string;
  }) {
    const invitation = await this.getInvitation(input.token);
    if (!invitation) return null;
    const existing = await this.db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(invitation.email)
      .first<{ id: string }>();
    if (existing) return { existing: true, userId: existing.id };
    const userId = randomId("usr");
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          userId,
          invitation.email,
          input.name,
          input.passwordHash,
          input.passwordSalt,
          now,
        ),
      this.db
        .prepare(
          "INSERT INTO memberships (household_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(invitation.householdId, userId, invitation.role, now),
      this.db
        .prepare("UPDATE invitations SET accepted_at = ? WHERE id = ?")
        .bind(now, invitation.id),
      this.auditStatement(
        invitation.householdId,
        userId,
        "invitation.accepted",
        invitation.id,
        new Date(now),
      ),
    ]);
    return { existing: false, userId };
  }

  async createSession(userId: string, lifetimeDays = 30): Promise<string> {
    const token = randomId("session");
    const now = new Date();
    const expires = new Date(now);
    expires.setUTCDate(expires.getUTCDate() + lifetimeDays);
    await this.db
      .prepare(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        randomId("ses"),
        userId,
        await sha256(token),
        expires.toISOString(),
        now.toISOString(),
      )
      .run();
    return token;
  }

  async getSession(token: string): Promise<SessionUser | null> {
    const row = await this.db
      .prepare(`
      SELECT u.id, u.email, u.name, h.id AS householdId, h.name AS householdName,
             m.role, s.expires_at AS expiresAt
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN memberships m ON m.user_id = u.id
      JOIN households h ON h.id = m.household_id
      WHERE s.token_hash = ? AND s.expires_at > ?
      ORDER BY m.created_at ASC LIMIT 1
    `)
      .bind(await sha256(token), new Date().toISOString())
      .first<SessionRow>();
    if (!row) return null;
    const { expiresAt: _expiresAt, ...user } = row;
    return user;
  }

  async deleteSession(token: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await sha256(token))
      .run();
  }

  async listSlides(householdId: string): Promise<SlideRow[]> {
    const result = await this.db
      .prepare(`
      SELECT s.id, s.kind, s.caption, s.message, s.theme, s.state,
             s.display_from AS displayFrom, s.display_until AS displayUntil,
             s.created_at AS createdAt, m.media_type AS mediaType, m.r2_key AS r2Key
      FROM slides s LEFT JOIN media_assets m ON m.id = s.media_asset_id
      WHERE s.household_id = ? AND s.state != 'archived'
      ORDER BY s.created_at DESC
    `)
      .bind(householdId)
      .all<SlideRow>();
    return result.results ?? [];
  }

  async countActiveSlides(
    householdId: string,
    now = new Date(),
  ): Promise<number> {
    const timestamp = now.toISOString();
    const row = await this.db
      .prepare(`
      SELECT COUNT(*) AS count FROM slides
      WHERE household_id = ? AND state = 'published'
      AND display_from <= ? AND (display_until IS NULL OR display_until > ?)
    `)
      .bind(householdId, timestamp, timestamp)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async createPhotoSlide(input: {
    householdId: string;
    userId: string;
    r2Key: string;
    contentType: string;
    sizeBytes: number;
    caption?: string;
    displayFrom?: string;
    displayUntil?: string | null;
    defaultVisibilityDays?: number;
  }): Promise<string> {
    if (
      (await this.countActiveSlides(input.householdId)) >= ACTIVE_SLIDE_LIMIT
    ) {
      throw new Error("ACTIVE_SLIDE_LIMIT");
    }
    const now = new Date();
    const schedule = defaultSchedule(now, input.defaultVisibilityDays);
    const displayFrom = input.displayFrom ?? schedule.displayFrom;
    const displayUntil =
      input.displayUntil === undefined
        ? schedule.displayUntil
        : input.displayUntil;
    if (!isValidScheduleWindow(displayFrom, displayUntil)) {
      throw new Error("INVALID_SCHEDULE");
    }
    const mediaId = randomId("media");
    const slideId = randomId("slide");
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO media_assets (id, household_id, uploader_user_id, r2_key, media_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          mediaId,
          input.householdId,
          input.userId,
          input.r2Key,
          input.contentType,
          input.sizeBytes,
          now.toISOString(),
        ),
      this.db
        .prepare(
          "INSERT INTO slides (id, household_id, kind, media_asset_id, caption, display_from, display_until, created_by, created_at, updated_at) VALUES (?, ?, 'photo', ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          slideId,
          input.householdId,
          mediaId,
          input.caption?.trim() || null,
          displayFrom,
          displayUntil,
          input.userId,
          now.toISOString(),
          now.toISOString(),
        ),
      this.bumpRevisionStatement(input.householdId),
      this.auditStatement(
        input.householdId,
        input.userId,
        "slide.created",
        slideId,
        now,
      ),
    ]);
    return slideId;
  }

  async createMessageSlide(input: {
    householdId: string;
    userId: string;
    message: string;
    theme?: string;
    displayFrom?: string;
    displayUntil?: string | null;
    defaultVisibilityDays?: number;
  }): Promise<string> {
    if (
      (await this.countActiveSlides(input.householdId)) >= ACTIVE_SLIDE_LIMIT
    ) {
      throw new Error("ACTIVE_SLIDE_LIMIT");
    }
    const now = new Date();
    const schedule = defaultSchedule(now, input.defaultVisibilityDays);
    const displayFrom = input.displayFrom ?? schedule.displayFrom;
    const displayUntil =
      input.displayUntil === undefined
        ? schedule.displayUntil
        : input.displayUntil;
    if (!isValidScheduleWindow(displayFrom, displayUntil)) {
      throw new Error("INVALID_SCHEDULE");
    }
    const slideId = randomId("slide");
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO slides (id, household_id, kind, message, theme, display_from, display_until, created_by, created_at, updated_at) VALUES (?, ?, 'message', ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          slideId,
          input.householdId,
          input.message.trim(),
          input.theme ?? "paper",
          displayFrom,
          displayUntil,
          input.userId,
          now.toISOString(),
          now.toISOString(),
        ),
      this.bumpRevisionStatement(input.householdId),
      this.auditStatement(
        input.householdId,
        input.userId,
        "slide.created",
        slideId,
        now,
      ),
    ]);
    return slideId;
  }

  async archiveSlide(
    householdId: string,
    userId: string,
    slideId: string,
  ): Promise<string | null> {
    const asset = await this.db
      .prepare(
        "SELECT m.r2_key AS r2Key FROM slides s LEFT JOIN media_assets m ON m.id = s.media_asset_id WHERE s.id = ? AND s.household_id = ?",
      )
      .bind(slideId, householdId)
      .first<{ r2Key: string | null }>();
    if (!asset) return null;
    const now = new Date();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE slides SET state = 'archived', updated_at = ? WHERE id = ? AND household_id = ?",
        )
        .bind(now.toISOString(), slideId, householdId),
      this.db
        .prepare(
          "UPDATE media_assets SET deleted_at = ? WHERE id = (SELECT media_asset_id FROM slides WHERE id = ?)",
        )
        .bind(now.toISOString(), slideId),
      this.bumpRevisionStatement(householdId),
      this.auditStatement(householdId, userId, "slide.archived", slideId, now),
    ]);
    return asset.r2Key;
  }

  async rescheduleSlide(input: {
    householdId: string;
    userId: string;
    slideId: string;
    displayFrom: string;
    displayUntil: string | null;
  }): Promise<boolean> {
    if (!isValidScheduleWindow(input.displayFrom, input.displayUntil)) {
      throw new Error("INVALID_SCHEDULE");
    }
    const existing = await this.db
      .prepare(
        "SELECT id FROM slides WHERE id = ? AND household_id = ? AND state != 'archived'",
      )
      .bind(input.slideId, input.householdId)
      .first<{ id: string }>();
    if (!existing) return false;
    const now = new Date();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE slides SET display_from = ?, display_until = ?, updated_at = ? WHERE id = ? AND household_id = ?",
        )
        .bind(
          input.displayFrom,
          input.displayUntil,
          now.toISOString(),
          input.slideId,
          input.householdId,
        ),
      this.bumpRevisionStatement(input.householdId),
      this.auditStatement(
        input.householdId,
        input.userId,
        "slide.rescheduled",
        input.slideId,
        now,
      ),
    ]);
    return true;
  }

  async getSettings(householdId: string): Promise<ViewerSettings> {
    const row = await this.db
      .prepare(
        "SELECT display_seconds AS displaySeconds, fit_mode AS fitMode, show_captions AS showCaptions, default_visibility_days AS defaultVisibilityDays FROM viewer_settings WHERE household_id = ?",
      )
      .bind(householdId)
      .first<{
        displaySeconds: number;
        fitMode: "contain" | "cover";
        showCaptions: number;
        defaultVisibilityDays: number;
      }>();
    return {
      displaySeconds: row?.displaySeconds ?? 12,
      fitMode: row?.fitMode ?? "contain",
      showCaptions: Boolean(row?.showCaptions ?? 1),
      defaultVisibilityDays: row?.defaultVisibilityDays ?? 30,
    };
  }

  async createPairingCode(householdId: string, name: string): Promise<string> {
    const code = String(
      crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000,
    ).padStart(6, "0");
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60_000);
    await this.db
      .prepare(
        "INSERT INTO devices (id, household_id, name, pairing_code_hash, pairing_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        randomId("device"),
        householdId,
        name.trim() || "Nagori frame",
        await sha256(code),
        expires.toISOString(),
        now.toISOString(),
      )
      .run();
    return code;
  }

  async listDevices(householdId: string): Promise<DeviceRow[]> {
    const result = await this.db
      .prepare(
        "SELECT id, name, last_seen_at AS lastSeenAt, created_at AS createdAt, CASE WHEN token_hash IS NULL THEN 0 ELSE 1 END AS paired FROM devices WHERE household_id = ? AND revoked_at IS NULL ORDER BY created_at DESC",
      )
      .bind(householdId)
      .all<DeviceRow>();
    return result.results ?? [];
  }

  async revokeDevice(input: {
    householdId: string;
    userId: string;
    deviceId: string;
  }): Promise<boolean> {
    const device = await this.db
      .prepare(
        "SELECT id FROM devices WHERE id = ? AND household_id = ? AND revoked_at IS NULL",
      )
      .bind(input.deviceId, input.householdId)
      .first<{ id: string }>();
    if (!device) return false;
    const now = new Date();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE devices SET revoked_at = ?, token_hash = NULL WHERE id = ? AND household_id = ?",
        )
        .bind(now.toISOString(), input.deviceId, input.householdId),
      this.auditStatement(
        input.householdId,
        input.userId,
        "device.revoked",
        input.deviceId,
        now,
      ),
    ]);
    return true;
  }

  async claimPairingCode(
    code: string,
  ): Promise<{ token: string; deviceId: string } | null> {
    const codeHash = await sha256(code);
    const device = await this.db
      .prepare(
        "SELECT id FROM devices WHERE pairing_code_hash = ? AND pairing_expires_at > ? AND revoked_at IS NULL",
      )
      .bind(codeHash, new Date().toISOString())
      .first<{ id: string }>();
    if (!device) return null;
    const token = randomId("frame");
    await this.db
      .prepare(
        "UPDATE devices SET token_hash = ?, pairing_code_hash = NULL, pairing_expires_at = NULL WHERE id = ?",
      )
      .bind(await sha256(token), device.id)
      .run();
    return { token, deviceId: device.id };
  }

  async findDevice(
    token: string,
  ): Promise<{ id: string; householdId: string } | null> {
    return this.db
      .prepare(
        "SELECT id, household_id AS householdId FROM devices WHERE token_hash = ? AND revoked_at IS NULL",
      )
      .bind(await sha256(token))
      .first<{ id: string; householdId: string }>();
  }

  async touchDevice(deviceId: string): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
    await this.db
      .prepare(
        "UPDATE devices SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)",
      )
      .bind(now.toISOString(), deviceId, cutoff)
      .run();
  }

  async getManifest(
    householdId: string,
    mediaBaseUrl: string,
  ): Promise<ViewerManifest> {
    const now = new Date().toISOString();
    const household = await this.db
      .prepare(
        "SELECT playlist_revision AS revision FROM households WHERE id = ?",
      )
      .bind(householdId)
      .first<{ revision: number }>();
    const result = await this.db
      .prepare(`
      SELECT s.id, s.kind, s.caption, s.message, s.theme,
             s.display_from AS displayFrom, s.display_until AS displayUntil,
             m.r2_key AS r2Key
      FROM slides s LEFT JOIN media_assets m ON m.id = s.media_asset_id
      WHERE s.household_id = ? AND s.state = 'published' AND s.display_from <= ?
      AND (s.display_until IS NULL OR s.display_until > ?)
      ORDER BY s.created_at DESC
    `)
      .bind(householdId, now, now)
      .all<Omit<ViewerSlide, "mediaUrl"> & { r2Key: string | null }>();
    const slides: ViewerSlide[] = (result.results ?? []).map(
      ({ r2Key, ...slide }) => ({
        ...slide,
        mediaUrl: r2Key
          ? `${mediaBaseUrl}/${encodeURIComponent(slide.id)}`
          : null,
      }),
    );
    return {
      revision: Number(household?.revision ?? 1),
      generatedAt: now,
      settings: await this.getSettings(householdId),
      slides,
    };
  }

  async mediaForDevice(
    householdId: string,
    slideId: string,
  ): Promise<{ r2Key: string; mediaType: string } | null> {
    return this.db
      .prepare(`
      SELECT m.r2_key AS r2Key, m.media_type AS mediaType
      FROM slides s JOIN media_assets m ON m.id = s.media_asset_id
      WHERE s.id = ? AND s.household_id = ? AND s.state = 'published'
    `)
      .bind(slideId, householdId)
      .first<{ r2Key: string; mediaType: string }>();
  }

  private bumpRevisionStatement(householdId: string) {
    return this.db
      .prepare(
        "UPDATE households SET playlist_revision = playlist_revision + 1 WHERE id = ?",
      )
      .bind(householdId);
  }

  private auditStatement(
    householdId: string,
    userId: string,
    action: string,
    subjectId: string,
    at: Date,
  ) {
    return this.db
      .prepare(
        "INSERT INTO audit_events (id, household_id, actor_user_id, action, subject_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        randomId("evt"),
        householdId,
        userId,
        action,
        subjectId,
        at.toISOString(),
      );
  }
}
