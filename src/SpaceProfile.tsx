import { useState } from "react";
import {
  DEFAULT_SPACE_NAME,
  MAX_SPACE_NAME,
  characters,
  spaceBadge,
  validateProfile,
} from "../electron/profile";
export function SpaceProfile({
  initialName = DEFAULT_SPACE_NAME,
  initialAvatar = "",
  firstRun = false,
  onSave,
}: {
  initialName?: string;
  initialAvatar?: string;
  firstRun?: boolean;
  onSave: (values: { spaceName: string; avatar: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName),
    [avatar, setAvatar] = useState(initialAvatar),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function save(useDefault = false) {
    setError("");
    try {
      const profile = validateProfile(
        useDefault
          ? { spaceName: DEFAULT_SPACE_NAME, avatar: "" }
          : { spaceName: name, avatar },
      );
      setSaving(true);
      await onSave(profile);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      className="space-profile"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="space-profile-heading">
        <span className="space-avatar">
          {spaceBadge(name || DEFAULT_SPACE_NAME, avatar)}
        </span>
        <div>
          <h2 id="space-title">
            {firstRun ? "Make this space yours." : "Your workspace"}
          </h2>
          <p className="muted">
            {firstRun
              ? "Give your local app library a name. You can change it anytime in Settings."
              : "Personalize the name and badge shown in your workspace."}
          </p>
        </div>
      </div>
      <label htmlFor={firstRun ? "welcome-name" : "settings-name"}>
        Space name
        <span className="character-count">
          {characters(name).length}/{MAX_SPACE_NAME}
        </span>
      </label>
      <input
        id={firstRun ? "welcome-name" : "settings-name"}
        autoFocus={firstRun}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={DEFAULT_SPACE_NAME}
        aria-describedby="space-name-help"
      />
      <p id="space-name-help" className="muted">
        Maximum 32 characters. Leave blank to use Ajo Space.
      </p>
      <label htmlFor={firstRun ? "welcome-avatar" : "settings-avatar"}>
        Badge (optional)
      </label>
      <input
        id={firstRun ? "welcome-avatar" : "settings-avatar"}
        value={avatar}
        onChange={(e) => setAvatar(e.target.value)}
        placeholder={spaceBadge(name || DEFAULT_SPACE_NAME)}
        aria-describedby="space-avatar-help"
      />
      <p id="space-avatar-help" className="muted">
        One emoji or up to two initials. Leave blank for automatic initials; Ajo
        Space uses AJ.
      </p>
      {error && (
        <p role="alert" className="amber">
          {error}
        </p>
      )}
      <div className="controls">
        <button disabled={saving} className="primary" type="submit">
          {saving ? "Saving…" : firstRun ? "Create my space" : "Save workspace"}
        </button>
        {firstRun && (
          <button
            disabled={saving}
            type="button"
            onClick={() => void save(true)}
          >
            Use Ajo Space
          </button>
        )}
      </div>
      {firstRun && (
        <p className="muted">Stored only on this Mac. No account required.</p>
      )}
    </form>
  );
}
