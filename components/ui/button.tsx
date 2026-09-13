import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f719e]/15 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#2f719e] text-white shadow-lg shadow-[#2f719e]/15 hover:-translate-y-0.5 hover:bg-[#275e83] hover:shadow-xl",
        destructive: "bg-red-700 text-white shadow-lg shadow-red-700/10 hover:bg-red-800",
        secondary: "bg-[#daeaf5] text-[#204c6b] hover:bg-[#c4def3]",
        outline: "border border-[#8ebbd9] bg-white/60 text-[#2f719e] hover:border-[#2f719e] hover:bg-[#edf6fc]",
        ghost: "text-[#334155] hover:bg-[#daeaf5] hover:text-[#204c6b]",
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
