import { FiNavigation } from "react-icons/fi";

interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
}

export default function BrandMark({
  className = "h-8 w-8",
  iconClassName = "h-4 w-4",
}: BrandMarkProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 ${className}`}
    >
      <FiNavigation className={iconClassName} aria-hidden="true" />
    </div>
  );
}