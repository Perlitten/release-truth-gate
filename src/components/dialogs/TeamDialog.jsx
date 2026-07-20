"use client";

import { useCallback, useEffect, useState } from "react";
import { SpinnerGap, UserPlus } from "@phosphor-icons/react";
import { Dialog } from "../feedback/Dialog.jsx";
import { Avatar } from "../core/Avatar.jsx";
import { Form } from "../forms/Form.jsx";
import { Field } from "../forms/Field.jsx";
import { Button } from "../core/Button.jsx";
import { ErrorMessage } from "../forms/ErrorMessage.jsx";
import { api, markers } from "../../lib/api.js";
import { initials } from "../../lib/format.js";

export function TeamDialog({ workspace, onClose }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [memberResult, invitationResult] = await Promise.all([
        api(`/api/workspaces/${workspace.id}/members`),
        api(`/api/workspaces/${workspace.id}/invitations`),
      ]);
      setMembers(memberResult.members);
      setInvitations(invitationResult.invitations);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        marker: markers.invite,
        body: { email: data.get("email"), role: data.get("role") },
      });
      setInviteUrl(result.inviteUrl);
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Workspace team" eyebrow={workspace.name} onClose={onClose} wide>
      <div className="rt-team-grid">
        <section>
          <h3>Members</h3>
          {busy && members.length === 0 ? (
            <p className="rt-muted"><SpinnerGap className="rt-spin" /> Loading team…</p>
          ) : (
            <div className="rt-member-list">
              {members.map((member) => (
                <div key={member.userId}>
                  <Avatar initials={initials(member.displayName)} />
                  <span><strong>{member.displayName}</strong><small>{member.email}</small></span>
                  <b>{member.role}</b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3>Invite teammate</h3>
          <Form compact onSubmit={invite}>
            <Field label="Email"><input type="email" name="email" required /></Field>
            <Field label="Role">
              <select name="role" defaultValue="reviewer">
                <option value="admin">Admin</option>
                <option value="contributor">Contributor</option>
                <option value="reviewer">Reviewer</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
            <Button busy={busy} type="submit">Create invite <UserPlus /></Button>
          </Form>
          {inviteUrl && (
            <div className="rt-invite-link">
              <span>Single-use invite link</span>
              <input value={inviteUrl} readOnly onFocus={(event) => event.target.select()} />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    setCopyStatus("Invite link copied.");
                  } catch {
                    setCopyStatus("Could not copy the link. Select and copy it manually.");
                  }
                }}
              >
                {copyStatus || "Copy link"}
              </button>
            </div>
          )}
          {invitations.length > 0 && (
            <p className="rt-muted">
              {invitations.filter((item) => !item.acceptedAt).length} pending invitation(s)
            </p>
          )}
        </section>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Dialog>
  );
}
