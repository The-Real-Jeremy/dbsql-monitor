import { ModeToggle } from "@/components/apx/mode-toggle";
import Logo from "@/components/apx/logo";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface NavbarProps {
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  className?: string;
  containerClassName?: string;
}

export function Navbar({
  leftContent,
  rightContent,
  className,
  containerClassName,
}: NavbarProps) {
  return (
    <header
      className={cn(
        "z-50 bg-background/80 backdrop-blur-sm border-b",
        className,
      )}
    >
      <div
        className={cn(
          "h-16 flex items-center justify-between px-4",
          containerClassName,
        )}
      >
        {leftContent || <Logo />}
        <div className="flex-1" />
        {rightContent || <ModeToggle />}
      </div>
    </header>
  );
}

export default Navbar;
