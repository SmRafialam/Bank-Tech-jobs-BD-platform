"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import type { ActionState } from "@/lib/forms";

export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

/** Progressive-enhancement form bound to a server action that returns an ActionState message. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, { ok: false, message: "" });
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state.ok ? state.message : undefined}
    >
      {children}
      <div className="mt-3" aria-live="polite">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ConfirmSubmit({ children, message, ...props }: ButtonProps & { message: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
