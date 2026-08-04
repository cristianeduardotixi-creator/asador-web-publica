import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  const variants: Record<string, string> = {
    primary: 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 shadow-sm',
    secondary: 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 active:bg-stone-100',
    ghost: 'bg-transparent text-stone-600 hover:bg-stone-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
    warning: 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700',
    dark: 'bg-stone-800 text-white hover:bg-stone-900 active:bg-black',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-xl',
    xl: 'px-8 py-4 text-lg rounded-xl',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'font-medium transition-all duration-150 select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-amber-400/50',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-2xl shadow-sm border border-stone-200/70', className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  color = 'stone',
}: {
  children: ReactNode;
  color?: 'stone' | 'amber' | 'emerald' | 'red' | 'blue' | 'orange';
}) {
  const colors: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-800',
    orange: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colors[color])}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const sizes: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        className={cn('w-full bg-white rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slideUp', sizes[size])}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
            <h3 className="text-lg font-semibold text-stone-800">{title}</h3>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">&times;</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('inline-block animate-spin rounded-full border-2 border-stone-300 border-t-amber-600', className)} />
  );
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-stone-300 mb-4">{icon}</div>}
      <p className="text-stone-500 font-medium">{title}</p>
      {subtitle && <p className="text-stone-400 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
