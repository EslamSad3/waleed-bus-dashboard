"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

type AsyncButtonProps = Omit<ButtonProps, "onClick" | "asChild"> & {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
};

/**
 * Button for click-triggered async actions (server actions, fetches).
 * For the lifetime of the promise returned by onClick the button disables
 * itself and shows a spinner, so a double click can never fire the request
 * twice. Handlers that return synchronously (open a dialog, toggle a filter)
 * never enter the busy state.
 */
const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  ({ onClick, loading = false, ...props }, ref) => {
    const [pending, setPending] = React.useState(false);
    const inFlight = React.useRef(false);

    function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
      if (inFlight.current) return;
      const result = onClick?.(event);
      if (result && typeof result.then === "function") {
        inFlight.current = true;
        setPending(true);
        void Promise.resolve(result).finally(() => {
          inFlight.current = false;
          setPending(false);
        });
      }
    }

    return <Button ref={ref} loading={pending || loading} onClick={handleClick} {...props} />;
  },
);
AsyncButton.displayName = "AsyncButton";

export { AsyncButton, type AsyncButtonProps };
