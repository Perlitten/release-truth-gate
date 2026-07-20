"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, GithubLogo, SpinnerGap } from "@phosphor-icons/react";
import { Dialog } from "../feedback/Dialog.jsx";
import { Form } from "../forms/Form.jsx";
import { Field } from "../forms/Field.jsx";
import { FieldRow } from "../forms/FieldRow.jsx";
import { Button } from "../core/Button.jsx";
import { ErrorMessage } from "../forms/ErrorMessage.jsx";
import { api, markers } from "../../lib/api.js";

export function GitHubDialog({ workspace, project, snapshot, onClose, onImported }) {
  const [installations, setInstallations] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [installationResult, repositoryResult] = await Promise.all([
        api(`/api/workspaces/${workspace.id}/github/installations?repositories=true`),
        project
          ? api(`/api/projects/${project.id}/repositories`)
          : Promise.resolve({ repositories: [] }),
      ]);
      setInstallations(installationResult.installations);
      setRepositories(repositoryResult.repositories);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [project, workspace.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/workspaces/${workspace.id}/github/connect`, {
        method: "POST",
        marker: markers.githubConnect,
        body: {},
      });
      window.location.assign(result.installUrl);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function link(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selected = JSON.parse(data.get("repository"));
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${project.id}/repositories`, {
        method: "POST",
        marker: markers.githubLink,
        body: selected,
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function importObject(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const objectType = data.get("objectType");
      await api(`/api/releases/${snapshot.release.id}/github/import`, {
        method: "POST",
        marker: markers.githubImport,
        body: {
          projectRepositoryId: data.get("projectRepositoryId"),
          objectType,
          reference: data.get("reference"),
          claimIds:
            objectType === "issue" || !data.get("claimId")
              ? []
              : [data.get("claimId")],
          relation: data.get("relation"),
          evidenceKind: data.get("evidenceKind"),
          material: true,
        },
      });
      await onImported();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  const available = installations.flatMap((installation) =>
    (installation.repositories || []).map((repository) => ({
      label: repository.fullName,
      value: JSON.stringify({
        githubInstallationId: installation.id,
        owner: repository.owner,
        repository: repository.name,
      }),
    })),
  );

  return (
    <Dialog title="GitHub evidence source" eyebrow={workspace.name} onClose={onClose} wide>
      <div className="rt-team-grid">
        <section>
          <h3>GitHub App installation</h3>
          <p className="rt-muted">
            Installation access is verified by GitHub before a repository can be linked.
          </p>
          <Button type="button" variant="secondary" onClick={connect} disabled={busy}>
            <GithubLogo /> Connect GitHub App
          </Button>
          {project && available.length > 0 && (
            <Form compact onSubmit={link}>
              <Field label="Repository">
                <select name="repository" required>
                  {available.map((item) => (
                    <option value={item.value} key={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>
              <Button busy={busy} type="submit">Link repository <ArrowRight /></Button>
            </Form>
          )}
          {installations.length > 0 && available.length === 0 && (
            <p className="rt-muted">No accessible repositories were returned by the installation.</p>
          )}
        </section>
        <section>
          <h3>Import immutable snapshot</h3>
          {snapshot && repositories.length > 0 ? (
            <Form compact onSubmit={importObject}>
              <Field label="Linked repository">
                <select name="projectRepositoryId" required>
                  {repositories.map((repository) => (
                    <option value={repository.id} key={repository.id}>
                      {repository.ownerLogin}/{repository.repositoryName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Object type">
                <select name="objectType" defaultValue="pull_request">
                  <option value="issue">Issue → claim</option>
                  <option value="pull_request">Pull request → evidence</option>
                  <option value="commit">Commit → evidence</option>
                  <option value="check_run">Check run → evidence</option>
                  <option value="status">Commit status → evidence</option>
                </select>
              </Field>
              <Field label="Number, SHA, or check-run id">
                <input name="reference" required maxLength={255} />
              </Field>
              <Field label="Link evidence to claim">
                <select name="claimId" defaultValue="">
                  <option value="">No claim link</option>
                  {snapshot.activeClaims.map((claim) => (
                    <option value={claim.id} key={claim.id}>{claim.title}</option>
                  ))}
                </select>
              </Field>
              <FieldRow>
                <Field label="Relation">
                  <select name="relation" defaultValue="supports">
                    <option value="supports">Supports</option>
                    <option value="contradicts">Contradicts</option>
                    <option value="missing">Missing</option>
                  </select>
                </Field>
                <Field label="Evidence kind">
                  <input name="evidenceKind" defaultValue="github" required />
                </Field>
              </FieldRow>
              <Button busy={busy} type="submit">Import snapshot <GithubLogo /></Button>
            </Form>
          ) : (
            <p className="rt-muted">
              Link a repository and open a release before importing.
            </p>
          )}
        </section>
      </div>
      {busy && <p className="rt-muted"><SpinnerGap className="rt-spin" /> Loading GitHub state…</p>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Dialog>
  );
}
