import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/soal.php")({
  beforeLoad: () => {
    throw redirect({ to: "/answers", statusCode: 301 });
  },
});
