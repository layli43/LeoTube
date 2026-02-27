import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

interface SubscribeButtonProps {
  onClick: ButtonProps["onClick"];
  disabled: boolean;
  isSubscribe: boolean;
  className?: string;
  size?: ButtonProps["size"];
}

export const SubscribeButton = ({
  onClick,
  disabled,
  isSubscribe,
  className,
  size,
}: SubscribeButtonProps) => {
  return (
    <Button
      size={size}
      variant={isSubscribe ? "secondary" : "default"}
      className={cn("rounded-full", className)}
      onClick={onClick}
      disabled={disabled}
    >
      {isSubscribe ? "Unsubscribe" : "Subscribe"}
    </Button>
  );
};
