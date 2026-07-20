"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Logo } from "../components/core/Logo.jsx";
import { Kicker } from "../components/core/Kicker.jsx";
import { Form } from "../components/forms/Form.jsx";
import { Field } from "../components/forms/Field.jsx";
import { ErrorMessage } from "../components/forms/ErrorMessage.jsx";
import { Button } from "../components/core/Button.jsx";

export function EmptyWorkspace({ user, onCreate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onCreate({ name: data.get("name") });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rt-onboarding">
      <section>
        <Logo />
        <Kicker>Welcome, {user.displayName}</Kicker>
        <h1>Create your first workspace</h1>
        <p>
          Workspaces keep projects, release evidence, teammates, and audit history
          under one authorization boundary.
        </p>
        <Form className="rt-onboarding-form" onSubmit={submit}>
          <Field label="Workspace name" hint="For example: Platform team">
            <input name="name" minLength={2} maxLength={120} required autoFocus />
          </Field>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button type="submit" busy={busy}>Create workspace <ArrowRight /></Button>
        </Form>
      </section>
    </main>
  );
}
