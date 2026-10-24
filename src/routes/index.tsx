import { createFileRoute } from "@tanstack/react-router";
import { CinderRun } from "@/components/cinder-run";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CinderRun />;
}
