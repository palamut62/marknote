import { X } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import sadUrl from "@/assets/mascot/sad.png";

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

type ToastProps = {
  open: boolean;
  message: string;
  onDismiss: () => void;
  action?: ToastAction;
  variant?: "error" | "info";
};

export function Toast({ open, message, onDismiss, action, variant = "error" }: ToastProps) {
  if (!open) return null;
  return (
    <div className={`mdv-toast mdv-toast--${variant}`} role="alert">
      <img
        src={sadUrl}
        alt=""
        aria-hidden
        width={40}
        height={40}
        draggable={false}
        className="mdv-toast__art"
      />
      <div className="mdv-toast__body">
        <span className="mdv-toast__msg">{message}</span>
        {action ? (
          <button
            type="button"
            className="mdv-toast__action"
            onClick={() => {
              void action.onClick();
              onDismiss();
            }}
          >
            {action.label}
          </button>
        ) : null}
      </div>
      <Button
        className="mdv-toast__dismiss"
        title="dismiss"
        aria-label="dismiss"
        onClick={onDismiss}
        icon={<Icon icon={X} size={12} strokeWidth={1.5} />}
      />
    </div>
  );
}
