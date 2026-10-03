import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function DemandDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="demand-dialog"
      aria-label={title}
      onCancel={onClose}
      onClose={onClose}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="eco-icon-button"
          title="Close dialog"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
