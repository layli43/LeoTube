import { ResponsiveModal } from "@/components/responsive-modal";
import { trpc } from "@/trpc/client";
import z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";

interface PlaylistCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  name: z.string().min(1),
});

export const PlaylistCreateModal = ({
  open,
  onOpenChange,
}: PlaylistCreateModalProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const utils = trpc.useUtils();
  const createPlaylist = trpc.playlists.create.useMutation({
    onSuccess: () => {
      utils.playlists.getMany.invalidate();
      toast.success("Playlist created");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createPlaylist.mutate({
      name: values.name,
    });
  };

  return (
    <ResponsiveModal
      title="Upload a thumbnail"
      open={open}
      onOpenChange={onOpenChange}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="resize-none"
                    placeholder="My favorite videos"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button disabled={createPlaylist.isPending} type="submit">
              Create
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  );
};
