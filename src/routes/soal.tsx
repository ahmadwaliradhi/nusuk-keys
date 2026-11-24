import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/soal")({
  beforeLoad: () => {
    throw redirect({ to: "/answers", statusCode: 301 });
  },
});
