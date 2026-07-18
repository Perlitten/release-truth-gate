import { HttpError } from "./errors.js";

const truncate = (value, max = 20_000) =>
  typeof value === "string" ? value.slice(0, max) : value ?? null;

const actor = (value) =>
  value
    ? {
        id: value.id == null ? null : String(value.id),
        login: value.login || null,
        type: value.type || null,
      }
    : null;

export function normalizeGitHubObject(objectType, payload) {
  if (objectType === "issue") {
    if (payload.pull_request) {
      throw new HttpError(
        400,
        "That issue number identifies a pull request. Import it as a pull request.",
        "github_object_type_mismatch",
      );
    }
    return {
      id: String(payload.id),
      nodeId: payload.node_id,
      number: payload.number,
      title: payload.title,
      body: truncate(payload.body),
      state: payload.state,
      stateReason: payload.state_reason,
      author: actor(payload.user),
      assignees: (payload.assignees || []).map(actor),
      labels: (payload.labels || []).map((label) =>
        typeof label === "string" ? label : label.name,
      ),
      milestone: payload.milestone?.title || null,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
      closedAt: payload.closed_at,
      url: payload.html_url,
    };
  }
  if (objectType === "pull_request") {
    return {
      id: String(payload.id),
      nodeId: payload.node_id,
      number: payload.number,
      title: payload.title,
      body: truncate(payload.body),
      state: payload.state,
      draft: Boolean(payload.draft),
      merged: Boolean(payload.merged),
      mergeableState: payload.mergeable_state || null,
      author: actor(payload.user),
      head: {
        ref: payload.head?.ref || null,
        sha: payload.head?.sha || null,
      },
      base: {
        ref: payload.base?.ref || null,
        sha: payload.base?.sha || null,
      },
      mergeCommitSha: payload.merge_commit_sha || null,
      changedFiles: payload.changed_files ?? null,
      additions: payload.additions ?? null,
      deletions: payload.deletions ?? null,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
      mergedAt: payload.merged_at,
      closedAt: payload.closed_at,
      url: payload.html_url,
    };
  }
  if (objectType === "commit") {
    return {
      sha: payload.sha,
      message: truncate(payload.commit?.message),
      author: {
        git: payload.commit?.author || null,
        github: actor(payload.author),
      },
      committer: {
        git: payload.commit?.committer || null,
        github: actor(payload.committer),
      },
      verification: payload.commit?.verification
        ? {
            verified: payload.commit.verification.verified,
            reason: payload.commit.verification.reason,
            signature: truncate(payload.commit.verification.signature, 8_000),
          }
        : null,
      parents: (payload.parents || []).map((parent) => parent.sha),
      stats: payload.stats || null,
      url: payload.html_url,
    };
  }
  if (objectType === "check_run") {
    return {
      id: String(payload.id),
      nodeId: payload.node_id,
      name: payload.name,
      status: payload.status,
      conclusion: payload.conclusion,
      headSha: payload.head_sha,
      externalId: payload.external_id,
      app: payload.app
        ? { id: String(payload.app.id), slug: payload.app.slug, name: payload.app.name }
        : null,
      output: payload.output
        ? {
            title: truncate(payload.output.title),
            summary: truncate(payload.output.summary),
            text: truncate(payload.output.text),
            annotationsCount: payload.output.annotations_count,
          }
        : null,
      startedAt: payload.started_at,
      completedAt: payload.completed_at,
      url: payload.html_url,
    };
  }
  if (objectType === "status") {
    return {
      sha: payload.sha,
      state: payload.state,
      totalCount: payload.total_count,
      repositoryId: payload.repository?.id
        ? String(payload.repository.id)
        : null,
      statuses: (payload.statuses || []).map((status) => ({
        id: String(status.id),
        context: status.context,
        state: status.state,
        description: truncate(status.description, 1_000),
        targetUrl: status.target_url,
        creator: actor(status.creator),
        createdAt: status.created_at,
        updatedAt: status.updated_at,
      })),
      url: payload.url,
    };
  }
  throw new HttpError(400, "Unsupported GitHub object type.", "github_object_type_invalid");
}

export function githubExternalId(objectType, normalized) {
  if (objectType === "commit" || objectType === "status") return normalized.sha;
  return String(normalized.id);
}

export function githubSummary(objectType, normalized) {
  if (objectType === "pull_request") {
    return `Pull request #${normalized.number}: ${normalized.title}`;
  }
  if (objectType === "commit") {
    return `Commit ${normalized.sha.slice(0, 12)}: ${normalized.message?.split("\n")[0] || "No message"}`;
  }
  if (objectType === "check_run") {
    return `Check ${normalized.name}: ${normalized.conclusion || normalized.status}`;
  }
  if (objectType === "status") {
    return `Commit status ${normalized.sha.slice(0, 12)}: ${normalized.state}`;
  }
  return normalized.title;
}
