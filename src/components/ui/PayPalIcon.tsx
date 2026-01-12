interface Props {
  size?: number;
  className?: string;
}

const PayPalIcon = ({ size = 16, className }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M10 16V9h3a2.5 2.5 0 1 1 0 5h-3" />
  </svg>
);

export default PayPalIcon;
