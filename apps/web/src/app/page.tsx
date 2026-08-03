import { ACTIVE_SLIDE_WARNING, scheduleStatus } from "@nagori/core";
import {
  archiveSlideAction,
  createMessageAction,
  createPairingCodeAction,
  createInvitationAction,
  loginAction,
  logoutAction,
  revokeDeviceAction,
  renewSlideAction,
  rescheduleSlideAction,
  setupAction,
  updateSettingsAction,
} from "./actions";
import { currentUser } from "@/lib/auth";
import { getEnv, getStore } from "@/lib/cloudflare";
import { ScheduleFields, UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      M
    </span>
  );
}

function AuthShell({
  mode,
  error,
}: {
  mode: "setup" | "login";
  error?: string;
}) {
  const setup = mode === "setup";
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="wordmark">
          <Logo />
          <span>Nagori <small lang="ja">名残</small></span>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">A window into family life</p>
          <h1>
            The photos that matter, <em>already there.</em>
          </h1>
          <p>
            Share a moment from your phone. It quietly appears on the family
            frame — no taps, passwords or instructions needed on the other side.
          </p>
        </div>
        <p className="auth-foot">
          Designed for old iPads and the people we love.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">
            {setup ? "First-time setup" : "Welcome back"}
          </p>
          <h2>
            {setup ? "Create your family space" : "Sign in to your family"}
          </h2>
          <p>
            {setup
              ? "You’ll be the owner. More family members can join later."
              : "Add a new photo, write a note, or check the frame."}
          </p>
          {error && (
            <div className="alert">
              {error === "login"
                ? "That email and password don’t match."
                : error === "rate_limited"
                  ? "Too many attempts. Please wait 15 minutes and try again."
                  : "Please check the details and use a password with at least 12 characters."}
            </div>
          )}
          <form
            action={setup ? setupAction : loginAction}
            className="auth-form"
          >
            {setup && (
              <>
                <label>
                  Your name
                  <input name="name" autoComplete="name" required />
                </label>
                <label>
                  Family space name
                  <input
                    name="householdName"
                    defaultValue="Our family"
                    required
                  />
                </label>
                <input name="timezone" type="hidden" value="Europe/Lisbon" />
              </>
            )}
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={12}
                autoComplete={setup ? "new-password" : "current-password"}
                required
              />
            </label>
            <button className="primary-button" type="submit">
              {setup ? "Create family space" : "Sign in"}
            </button>
          </form>
          {!setup && (
            <p className="auth-note">
              Accounts are invitation-only. Ask your family owner for an invite.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Icon({
  name,
}: {
  name: "home" | "photo" | "people" | "frame" | "settings";
}) {
  const paths = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m5 17 4-4 3 3 2-2 5 3" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.3.5 3.5 2.5 3.5 5" />
      </>
    ),
    frame: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 17h8M12 7v6M9 10h6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Forever";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const store = getStore();
  const hasUsers = await store.hasUsers();
  if (!hasUsers)
    return (
      <AuthShell
        mode="setup"
        error={typeof params.error === "string" ? params.error : undefined}
      />
    );
  const user = await currentUser();
  if (!user)
    return (
      <AuthShell
        mode="login"
        error={typeof params.error === "string" ? params.error : undefined}
      />
    );

  const [slides, settings, activeCount, members, devices] = await Promise.all([
    store.listSlides(user.householdId),
    store.getSettings(user.householdId),
    store.countActiveSlides(user.householdId),
    store.listMembers(user.householdId),
    store.listDevices(user.householdId),
  ]);
  const grouped = {
    active: slides.filter((slide) => scheduleStatus(slide) === "active"),
    upcoming: slides.filter((slide) => scheduleStatus(slide) === "upcoming"),
    expired: slides.filter((slide) => scheduleStatus(slide) === "expired"),
  };
  const pairing = typeof params.pairing === "string" ? params.pairing : null;
  const invite = typeof params.invite === "string" ? params.invite : null;
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#top" className="brand">
          <Logo />
          <span>Nagori <small lang="ja">名残</small></span>
        </a>
        <nav>
          <a href="#top" className="active">
            <Icon name="home" />
            Today
          </a>
          <a href="#library">
            <Icon name="photo" />
            Library <span>{slides.length}</span>
          </a>
          <a href="#family">
            <Icon name="people" />
            Family
          </a>
          <a href="#frame">
            <Icon name="frame" />
            Frame
          </a>
          <a href="#settings">
            <Icon name="settings" />
            Settings
          </a>
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <form action={logoutAction}>
            <button title="Sign out" type="submit">
              ↗
            </button>
          </form>
        </div>
      </aside>
      <main className="dashboard" id="top">
        <header className="topbar">
          <button className="mobile-brand" type="button">
            <Logo />
          </button>
          <div>
            <p>{user.householdName}</p>
            <span>Private family space</span>
          </div>
          <a
            className="frame-link"
            href={getEnv().FRAME_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span className="online-dot" /> Open frame
          </a>
        </header>
        <div className="content">
          <section className="welcome">
            <div>
              <p className="eyebrow">Monday, August 3</p>
              <h1>Good evening, {user.name.split(" ")[0]}.</h1>
              <p>
                {activeCount === 0
                  ? "The frame is ready for its first memory."
                  : `${activeCount} ${activeCount === 1 ? "memory is" : "memories are"} keeping the frame company.`}
              </p>
            </div>
            <a href="#compose" className="primary-button">
              ＋ Add a memory
            </a>
          </section>
          {activeCount >= ACTIVE_SLIDE_WARNING && (
            <div className="alert warning">
              The rotation has {activeCount} active slides. Archive a few or
              give them an end date before it reaches the 200-slide limit.
            </div>
          )}
          {pairing && (
            <section className="pair-banner">
              <div>
                <p className="eyebrow">Frame pairing code</p>
                <strong>
                  {pairing.slice(0, 3)} {pairing.slice(3)}
                </strong>
                <p>
                  Open the frame at <b>{getEnv().FRAME_URL}</b> and enter this
                  code. It expires in 15 minutes.
                </p>
              </div>
              <a href={getEnv().FRAME_URL} target="_blank" rel="noreferrer">
                Open frame ↗
              </a>
            </section>
          )}
          {invite && (
            <section className="invite-banner">
              <div>
                <p className="eyebrow">Invitation ready</p>
                <strong>Private invite link</strong>
                <p>
                  Copy this private link and send it to the family member you
                  invited. It expires in seven days.
                </p>
              </div>
              <code>{`${getEnv().APP_URL}/join/${invite}`}</code>
            </section>
          )}
          <section id="compose" className="composer">
            <div className="section-intro">
              <p className="eyebrow">Share something new</p>
              <h2>A small moment makes their day.</h2>
            </div>
            <div className="composer-grid">
              <div className="compose-pane">
                <div className="pane-title">
                  <span className="round-icon">↗</span>
                  <div>
                    <h3>Share a photo</h3>
                    <p>From your camera roll to the frame.</p>
                  </div>
                </div>
                <UploadForm />
              </div>
              <div className="compose-pane message-pane">
                <div className="pane-title">
                  <span className="round-icon">✎</span>
                  <div>
                    <h3>Write a note</h3>
                    <p>A hello, reminder, or little story.</p>
                  </div>
                </div>
                <form action={createMessageAction} className="composer-form">
                  <label>
                    Message
                    <textarea
                      name="message"
                      maxLength={280}
                      placeholder="Thinking of you both today…"
                      required
                    />
                  </label>
                  <label>
                    Background
                    <select name="theme" defaultValue="paper">
                      <option value="paper">Warm paper</option>
                      <option value="sunset">Sunset coral</option>
                      <option value="garden">Garden green</option>
                    </select>
                  </label>
                  <ScheduleFields />
                  <button className="secondary-button" type="submit">
                    Add note to frame
                  </button>
                </form>
              </div>
            </div>
          </section>
          <section id="library" className="library">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Current rotation</p>
                <h2>What they’re seeing</h2>
              </div>
              <p>{activeCount} of 200 active</p>
            </div>
            {grouped.active.length === 0 ? (
              <div className="empty-library">
                <span>□</span>
                <h3>No active memories yet</h3>
                <p>
                  Share a photo or note above and it will arrive on the frame
                  within a minute.
                </p>
              </div>
            ) : (
              <div className="memory-grid">
                {grouped.active.map((slide) => (
                  <article
                    className={`memory-card ${slide.kind}`}
                    key={slide.id}
                  >
                    {slide.kind === "photo" ? (
                      <img
                        src={`/api/media/${encodeURIComponent(slide.id)}`}
                        alt={slide.caption || "Family memory"}
                      />
                    ) : (
                      <div className="note-preview" data-theme={slide.theme}>
                        {slide.message}
                      </div>
                    )}
                    <div className="memory-meta">
                      <div>
                        <span className="status active">Showing now</span>
                        <h3>
                          {slide.caption ||
                            (slide.kind === "message"
                              ? "Family note"
                              : "Untitled memory")}
                        </h3>
                        <p>Until {formatDate(slide.displayUntil)}</p>
                      </div>
                      <form action={archiveSlideAction}>
                        <input type="hidden" name="slideId" value={slide.id} />
                        <button title="Archive slide" type="submit">
                          Archive
                        </button>
                      </form>
                    </div>
                    <details className="schedule-editor">
                      <summary>Change schedule</summary>
                      <form action={rescheduleSlideAction}>
                        <input type="hidden" name="slideId" value={slide.id} />
                        <label>
                          From
                          <input
                            name="displayFrom"
                            type="date"
                            defaultValue={dateInputValue(slide.displayFrom)}
                            required
                          />
                        </label>
                        <label>
                          Until
                          <input
                            name="displayUntil"
                            type="date"
                            defaultValue={dateInputValue(slide.displayUntil)}
                          />
                        </label>
                        <label className="check">
                          <input name="forever" type="checkbox" value="yes" />
                          Keep in rotation forever
                        </label>
                        <button className="text-button" type="submit">
                          Save schedule
                        </button>
                      </form>
                    </details>
                  </article>
                ))}
              </div>
            )}
            {(grouped.upcoming.length > 0 || grouped.expired.length > 0) && (
              <div className="schedule-groups">
                {grouped.upcoming.length > 0 && (
                  <div>
                    <h3>Coming up</h3>
                    {grouped.upcoming.map((slide) => (
                      <div className="schedule-item" key={slide.id}>
                        <strong>
                          {slide.caption || slide.message?.slice(0, 45)}
                        </strong>
                        <span>Starts {formatDate(slide.displayFrom)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {grouped.expired.length > 0 && (
                  <div>
                    <h3>Ready to archive</h3>
                    {grouped.expired.map((slide) => (
                      <div className="schedule-item" key={slide.id}>
                        <strong>
                          {slide.caption || slide.message?.slice(0, 45)}
                        </strong>
                        <span>Ended {formatDate(slide.displayUntil)}</span>
                        <form action={renewSlideAction}>
                          <input
                            type="hidden"
                            name="slideId"
                            value={slide.id}
                          />
                          <button className="text-button" type="submit">
                            Renew for {settings.defaultVisibilityDays} days
                          </button>
                        </form>
                        <form action={archiveSlideAction}>
                          <input
                            type="hidden"
                            name="slideId"
                            value={slide.id}
                          />
                          <button className="text-button" type="submit">
                            Archive
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="bottom-grid">
            <div id="frame" className="utility-section">
              <p className="eyebrow">Frame</p>
              <h2>Connect an iPad</h2>
              <p>
                Open the viewer on the iPad, add it to the Home Screen, then
                pair it once. After that, it updates by itself.
              </p>
              <form action={createPairingCodeAction} className="inline-form">
                <input name="name" placeholder="Grandparents’ iPad" required />
                <button className="secondary-button" type="submit">
                  Create pairing code
                </button>
              </form>
            </div>
            <div id="settings" className="utility-section">
              <p className="eyebrow">Playback</p>
              <h2>Keep it comfortable</h2>
              <form action={updateSettingsAction} className="settings-form">
                <label>
                  Seconds per slide
                  <input
                    name="displaySeconds"
                    type="number"
                    min="5"
                    max="60"
                    defaultValue={settings.displaySeconds}
                  />
                </label>
                <label>
                  Photo fit
                  <select name="fitMode" defaultValue={settings.fitMode}>
                    <option value="contain">Show whole photo</option>
                    <option value="cover">Fill the screen</option>
                  </select>
                </label>
                <label>
                  Default lifetime
                  <select
                    name="defaultVisibilityDays"
                    defaultValue={settings.defaultVisibilityDays}
                  >
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    name="showCaptions"
                    type="checkbox"
                    defaultChecked={settings.showCaptions}
                  />{" "}
                  Show captions
                </label>
                <button className="text-button" type="submit">
                  Save settings
                </button>
              </form>
            </div>
          </section>
          <section id="family" className="family-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Family access</p>
                <h2>People in {user.householdName}</h2>
              </div>
              <p>
                {members.length} {members.length === 1 ? "person" : "people"}
              </p>
            </div>
            <div className="family-grid">
              <div className="member-list">
                {members.map((member) => (
                  <div key={member.id}>
                    <span className="avatar">
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                    <p>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </p>
                    <em>{member.role}</em>
                  </div>
                ))}
              </div>
              {user.role === "owner" && (
                <form action={createInvitationAction} className="invite-form">
                  <h3>Invite someone</h3>
                  <p>We create a private link for you to send.</p>
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      placeholder="family@example.com"
                      required
                    />
                  </label>
                  <label>
                    Access
                    <select name="role">
                      <option value="editor">Can share memories</option>
                      <option value="viewer">Can only view</option>
                    </select>
                  </label>
                  <button className="secondary-button" type="submit">
                    Create invite link
                  </button>
                </form>
              )}
            </div>
          </section>
          {devices.length > 0 && (
            <section className="device-list">
              <p className="eyebrow">Connected frames</p>
              {devices.map((device) => (
                <div key={device.id}>
                  <strong>{device.name}</strong>
                  <span>
                    {device.paired
                      ? device.lastSeenAt
                        ? `Seen ${formatDate(device.lastSeenAt)}`
                        : "Paired · waiting for first check-in"
                      : "Waiting to be paired"}
                  </span>
                  {user.role === "owner" && (
                    <form action={revokeDeviceAction}>
                      <input type="hidden" name="deviceId" value={device.id} />
                      <button className="text-button" type="submit">
                        Revoke
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </section>
          )}
          <footer>
            Nagori <span lang="ja">名残</span> <span>·</span> The memories
            that remain.
          </footer>
        </div>
      </main>
    </div>
  );
}
