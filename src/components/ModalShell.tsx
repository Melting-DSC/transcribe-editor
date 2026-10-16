import React, { useEffect } from 'react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Extra classes for the panel, e.g. a max-width override. */
  panelClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared modal frame: centred overlay, Escape-to-close, and backdrop-click-close.
 * Keeps the dialog semantics (role/aria-modal) consistent across every modal.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  panelClassName = '',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
