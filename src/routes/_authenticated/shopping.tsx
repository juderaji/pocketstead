import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/shopping")({
  beforeLoad: () => {
    throw redirect({ to: "/planned" });
  },
});
