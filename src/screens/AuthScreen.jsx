"use client";

import { useState } from "react";
import {
  ArrowRight,
  BracketsCurly,
  ClipboardText,
  Database,
  LockKey,
  ShieldCheck,
  Sparkle,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";
import { Logo } from "../components/core/Logo.jsx";
import { Kicker } from "../components/core/Kicker.jsx";
import { Notice } from "../components/forms/Notice.jsx";
import { Form } from "../components/forms/Form.jsx";
import { Field } from "../components/forms/Field.jsx";
import { ErrorMessage } from "../components/forms/ErrorMessage.jsx";
import { Button } from "../components/core/Button.jsx";
import { api, markers } from "../lib/api.js";

export function AuthScreen({ invitation, bootError, onAuthenticated }) {
  const [mode, setMode] = useState("register");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(bootError || "");

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload =
        mode === "register"
          ? {
              email: data.get("email"),
              displayName: data.get("displayName"),
              password: data.get("password"),
            }
          : {
              email: data.get("email"),
              password: data.get("password"),
            };
      const result = await api(`/api/auth/${mode}`, {
        method: "POST",
        marker: markers[mode],
        body: payload,
      });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/demo/session", {
        method: "POST",
        marker: markers.demo,
      });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rt-auth">
      <section className="rt-auth-story">
        <Logo large />
        <Kicker>Release Truth</Kicker>
        <h1>Decide what ships.<br />Show the evidence.</h1>
        <p>
          A shared release gate for claims, immutable evidence, human decisions,
          and reproducible server verdicts.
        </p>
        <div className="rt-auth-proof">
          <span><Database /> PostgreSQL source of truth</span>
          <span><UsersThree /> Workspace roles</span>
          <span><LockKey /> Append-only records</span>
        </div>
        <ol className="rt-auth-steps">
          <li><ClipboardText weight="duotone" /> <span>Record a claim your release must satisfy</span></li>
          <li><BracketsCurly weight="duotone" /> <span>Attach current code, test, or policy evidence</span></li>
          <li><ShieldCheck weight="duotone" /> <span>Get a reproducible GO / NO-GO from the server</span></li>
        </ol>
      </section>
      <section className="rt-auth-card">
        <div className="rt-auth-tabs">
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
        </div>
        {invitation && (
          <Notice>
            <UserPlus /> Sign in with the invited email to join the workspace.
          </Notice>
        )}
        <Form onSubmit={submit}>
          {mode === "register" && (
            <Field label="Your name">
              <input name="displayName" minLength={2} maxLength={120} required autoFocus />
            </Field>
          )}
          <Field label="Work email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus={mode === "login"}
            />
          </Field>
          <Field
            label="Password"
            hint={mode === "register" ? "At least 12 characters." : undefined}
          >
            <input
              name="password"
              type="password"
              minLength={mode === "register" ? 12 : 1}
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </Field>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button busy={busy} type="submit">
          {mode === "register" ? "Create account" : "Sign in"} <ArrowRight />
        </Button>
      </Form>
      <Button
        variant="secondary"
        type="button"
        className="rt-demo-entry"
        disabled={busy}
        onClick={enterDemo}
      >
        <Sparkle weight="fill" /> Explore the Nova 2.4 demo
      </Button>
      <p className="rt-auth-foot">
        Product data stays on the server. Clearing your browser does not erase it.
      </p>
      </section>
    </main>
  );
}
