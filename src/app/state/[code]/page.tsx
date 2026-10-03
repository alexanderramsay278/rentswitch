import { redirect, notFound } from "next/navigation";
import { STATES } from "@/lib/questions";

/**
 * Old entry point for states the model did not yet cover. Every state the survey offers is
 * now modelled, so known codes go straight to the survey and anything else is a 404.
 */
export default async function StatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const upper = code.toUpperCase();

  if (STATES.some((s) => s.code === upper)) {
    redirect("/start");
  }
  notFound();
}
