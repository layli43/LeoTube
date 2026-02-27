import Link from "next/link";
import { VideoGetOneOutput } from "../../types";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { SubscribeButton } from "@/modules/subscriptions/ui/components/subscribe-button";
import { UserInfo } from "@/modules/users/ui/components/user-info";

interface VideoOwnerProps {
  user: VideoGetOneOutput["user"];
  videoId: string;
}

export const VideoOwner = ({ user, videoId }: VideoOwnerProps) => {
  const { userId } = useAuth();

  return (
    <div
      className="flex items-center sm:items-start justify-between sm:justify-start gap-3
    min-2-0"
    >
      <Link href={`/users/${user.id}`}>
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar size="lg" imageUrl={user.imageUrl} name={user.name} />
          <UserInfo size="lg" name={user.name} />
          <span className="text-smm text-muted-foreground line-clamp-1">
            {/* TODO: properly fill subscriber count */}
            {0} subscribers
          </span>
        </div>
      </Link>
      {userId === user.clerkId ? (
        <Button className="rounded-full" asChild>
          <Link href={`/studio/videos/${videoId}`}>Edit video</Link>
        </Button>
      ) : (
        <SubscribeButton
          onClick={() => {}}
          disabled={false}
          isSubscribe={false}
          className="flex"
        />
      )}
    </div>
  );
};
