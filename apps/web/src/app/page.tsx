import { ACTIVE_SLIDE_WARNING, scheduleStatus } from "@nagori/core";
import { Button, Field, Input, SlidePreview } from "@nagori/ui";
import { currentUser } from "@/lib/auth";
import { getEnv, getStore } from "@/lib/cloudflare";
import { DashboardShell } from "@/components/dashboard-shell";
import { isTabKey, type TabKey } from "@/lib/tabs";
import { InviteForm, PendingInvites } from "@/components/family-forms";
import { CreateFrameForm, DeviceRows } from "@/components/frame-forms";
import { MemoryForm } from "@/components/memory-form";
import { SortableLibrary } from "@/components/sortable-library";
import { SettingsForm } from "@/components/settings-form";
import {
  archiveSlideAction,
  logoutAction,
  loginAction,
  renewSlideAction,
  rescheduleSlideAction,
  setupAction,
} from "./actions";

export const dynamic = "force-dynamic";

function Logo() {
  return (
    // Plain <img>: the file is a fixed-size static asset in /public, so the
    // Next image loader would only add a request for the same bytes.
    <img
      className="logo"
      src="/logo.png"
      alt=""
      width={38}
      height={38}
      aria-hidden="true"
    />
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
          <span>
            Nagori <small lang="ja">名残</small>
          </span>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">A quiet way to stay close</p>
          <h1>
            The photos that matter, <em>already there.</em>
          </h1>
          <p>
            Share a moment from your phone, and it appears on the family frame
            at home — no taps, passwords, or setup for the people watching.
          </p>
        </div>
        <p className="auth-foot">Made for the people you love.</p>
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
                  : error === "owner_email"
                    ? "Setup is reserved for this deployment’s configured owner email."
                    : "Please check the details and use a password with at least 12 characters."}
            </div>
          )}
          <form
            action={setup ? setupAction : loginAction}
            className="auth-form"
          >
            {setup && (
              <>
                <Field label="Your name">
                  <Input name="name" autoComplete="name" required />
                </Field>
                <Field label="Family space name">
                  <Input
                    name="householdName"
                    defaultValue="Our family"
                    required
                  />
                </Field>
                <input name="timezone" type="hidden" value="Europe/Lisbon" />
              </>
            )}
            <Field label="Email address">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                minLength={12}
                autoComplete={setup ? "new-password" : "current-password"}
                required
              />
            </Field>
            <Button type="submit">
              {setup ? "Create family space" : "Sign in"}
            </Button>
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

function formatDate(value: string | null) {
  if (!value) return "Forever";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
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

  const [slides, settings, activeCount, members, devices, invitations] =
    await Promise.all([
      store.listSlides(user.householdId),
      store.getSettings(user.householdId),
      store.countActiveSlides(user.householdId),
      store.listMembers(user.householdId),
      store.listDevices(user.householdId),
      store.listPendingInvitations(user.householdId),
    ]);
  const grouped = {
    active: slides.filter((slide) => scheduleStatus(slide) === "active"),
    upcoming: slides.filter((slide) => scheduleStatus(slide) === "upcoming"),
    expired: slides.filter((slide) => scheduleStatus(slide) === "expired"),
  };
  const initialTab: TabKey = isTabKey(params.tab) ? params.tab : "today";
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rotationWarning = activeCount >= ACTIVE_SLIDE_WARNING && (
    <div className="alert warning">
      There are {activeCount} memories on the frame. Archive a few, or give some
      an end date, before you reach the limit of 200.
    </div>
  );

  return (
    <DashboardShell
      initialTab={initialTab}
      libraryCount={slides.length}
      brand={
        <span className="brand">
          <Logo />
          <span>
            Nagori <small lang="ja">名残</small>
          </span>
        </span>
      }
      account={
        <div className="sidebar-foot">
          <div className="sidebar-identity">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </div>
          <form action={logoutAction}>
            <Button size="sm" type="submit" variant="subtle">
              Sign out
            </Button>
          </form>
        </div>
      }
      topbar={
        <header className="topbar">
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
      }
      panels={{
        today: (
          <>
            <section className="welcome">
              <div>
                <h1>Hello, {user.name.split(" ")[0]}.</h1>
                <p>
                  {activeCount === 0
                    ? "The frame is ready for its first memory."
                    : `${activeCount} ${activeCount === 1 ? "memory is" : "memories are"} playing on the frame right now.`}
                </p>
              </div>
            </section>
            {rotationWarning}
            <section className="composer">
              <div className="section-intro">
                <p className="eyebrow">Share something new</p>
                <h2>What would you like to share?</h2>
              </div>
              <MemoryForm showCaptions={settings.showCaptions} />
            </section>
          </>
        ),
        library: (
          <section className="library">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Current rotation</p>
                <h2>What they’re seeing</h2>
                <p className="section-note">
                  This is the order the frame plays. Drag a card by its handle
                  to change it.
                </p>
              </div>
              <p>{activeCount} of 200 active</p>
            </div>
            {rotationWarning}
            {grouped.active.length === 0 ? (
              <div className="empty-library">
                <span>□</span>
                <h3>No active memories yet</h3>
                <p>
                  Share a photo or note and it will arrive on the frame within a
                  minute.
                </p>
              </div>
            ) : (
              <SortableLibrary
                canReorder={user.role !== "viewer"}
                settings={settings}
                slides={grouped.active}
              />
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
                          <Button size="sm" type="submit" variant="outline">
                            Renew for {settings.defaultVisibilityDays} days
                          </Button>
                        </form>
                        <form action={archiveSlideAction}>
                          <input
                            type="hidden"
                            name="slideId"
                            value={slide.id}
                          />
                          <Button size="sm" type="submit" variant="subtle">
                            Archive
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        ),
        family: (
          <section className="family-section">
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
              <div>
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
                  <PendingInvites invitations={invitations} />
                )}
              </div>
              {user.role === "owner" && <InviteForm />}
            </div>
          </section>
        ),
        frame: (
          <section className="utility-section">
            <p className="eyebrow">Frame</p>
            <h2>Connect an iPad</h2>
            <p>
              Name the frame, then send the link to whoever has the iPad. They
              open it, add it to the Home Screen, and tap Connect once. After
              that it updates by itself.
            </p>
            <CreateFrameForm />
            {devices.length > 0 && (
              <DeviceRows devices={devices} isOwner={user.role === "owner"} />
            )}
          </section>
        ),
        settings: (
          <section className="utility-section">
            <p className="eyebrow">Playback</p>
            <h2>How the frame plays</h2>
            <p>These settings apply to every frame in your family space.</p>
            <SettingsForm
              settings={settings}
              saved={params.saved === "settings"}
            />
          </section>
        ),
      }}
    />
  );
}
