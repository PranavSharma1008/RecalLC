import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'rlc-btn-primary',
  secondary: 'rlc-btn-secondary',
  ghost: 'rlc-btn-ghost',
  danger: 'rlc-btn-danger',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-[13px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`rlc-btn ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}
