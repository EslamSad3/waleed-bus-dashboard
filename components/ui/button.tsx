import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/25 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#00134c] text-white shadow-lg shadow-[#00134c]/20 hover:-translate-y-0.5 hover:bg-[#001d6b] hover:shadow-xl",
        secondary: "bg-[#059ff8] text-white shadow-lg shadow-[#059ff8]/20 hover:-translate-y-0.5 hover:bg-[#0485d1] hover:shadow-xl",
        success: "bg-[#16a34a] text-white shadow-lg shadow-[#16a34a]/20 hover:-translate-y-0.5 hover:bg-[#128a3f] hover:shadow-xl",
        danger: "bg-[#dc2626] text-white shadow-lg shadow-[#dc2626]/15 hover:-translate-y-0.5 hover:bg-[#b91c1c] hover:shadow-xl",
        destructive: "bg-[#dc2626] text-white shadow-lg shadow-[#dc2626]/15 hover:bg-[#b91c1c]",
        outline: "border border-[#059ff8] bg-white/60 text-[#00134c] hover:bg-[#eaf6ff]",
        ghost: "text-[#334155] hover:bg-[#eaf6ff] hover:text-[#00134c]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
