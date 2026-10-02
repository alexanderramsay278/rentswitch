"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  STATES,
  DWELLINGS,
  HOT_WATER_OPTIONS,
  COOKTOP_OPTIONS,
  HEATING_OPTIONS,
  OCCUPANT_OPTIONS,
  hotWaterIsModelled,
  answersToQuery,
  type Answers,
  type StateCode,
} from "@/lib/questions";

type StepKey =
  | "occupants"
  | "state"
  | "dwelling"
  | "hotWater"
  | "lastGas"
  | "cooktop"
  | "heating"
  | "rent";

const BASE_ORDER: StepKey[] = [
  "occupants",
  "state",
  "dwelling",
  "hotWater",
  "lastGas",
  "cooktop",
  "heating",
  "rent",
];

function visibleSteps(a: Partial<Answers>): StepKey[] {
  return BASE_ORDER.filter((step) => {
    if (step === "lastGas") {
      return a.hotWater === undefined || hotWaterIsModelled(a.hotWater);
    }
    return true;
  });
}

function ChoiceGrid<T extends string>({
  options,
  onPick,
  columns = 1,
}: {
  options: readonly { value: T; label: string }[];
  onPick: (value: T) => void;
  columns?: 1 | 2;
}) {
  return (
    <div className={columns === 2 ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className="w-full rounded-lg border border-stone-300 bg-white px-5 py-4 text-left text-base font-medium text-stone-800 shadow-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Wizard() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [rentInput, setRentInput] = useState("");

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;

  function goNext(partial: Partial<Answers>) {
    const nextAnswers = { ...answers, ...partial };
    setAnswers(nextAnswers);
    const nextSteps = visibleSteps(nextAnswers);
    const currentPos = nextSteps.indexOf(currentStep);
    const target = currentPos === -1 ? stepIndex : currentPos + 1;
    if (target >= nextSteps.length) {
      submit(nextAnswers);
    } else {
      setStepIndex(target);
    }
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function submit(final: Partial<Answers>) {
    const complete = final as Answers;
    router.push(`/results?${answersToQuery(complete)}`);
  }

  function pickState(code: StateCode) {
    if (code !== "NSW") {
      router.push(`/state/${code.toLowerCase()}`);
      return;
    }
    goNext({ state: code });
  }

  const progressPct = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Question {stepIndex + 1} of {totalSteps}
        </p>
      </div>

      {currentStep === "occupants" && (
        <Step title="How many people live there?">
          <ChoiceGrid
            columns={2}
            options={OCCUPANT_OPTIONS.map((n) => ({
              value: String(n),
              label: n === 4 ? "4+" : String(n),
            }))}
            onPick={(v) => goNext({ occupants: Number(v) as Answers["occupants"] })}
          />
        </Step>
      )}

      {currentStep === "state" && (
        <Step title="Which state do you rent in?" onBack={stepIndex > 0 ? goBack : undefined}>
          <ChoiceGrid
            columns={2}
            options={STATES.map((s) => ({ value: s.code, label: s.label }))}
            onPick={pickState}
          />
        </Step>
      )}

      {currentStep === "dwelling" && (
        <Step title="What kind of place is it?" onBack={goBack}>
          <ChoiceGrid
            options={DWELLINGS.map((d) => ({ value: d.value, label: d.label }))}
            onPick={(v) => goNext({ dwelling: v as Answers["dwelling"] })}
          />
        </Step>
      )}

      {currentStep === "hotWater" && (
        <Step title="What heats your hot water?" onBack={goBack}>
          <ChoiceGrid
            options={HOT_WATER_OPTIONS}
            onPick={(v) => goNext({ hotWater: v })}
          />
        </Step>
      )}

      {currentStep === "lastGas" && (
        <Step title="Is hot water your only gas appliance?" onBack={goBack}>
          <p className="mb-4 text-sm text-stone-500">
            This decides whether the gas daily supply charge disappears if you switch - it&apos;s
            worth 44% of the modelled saving.
          </p>
          <ChoiceGrid
            options={[
              { value: "yes", label: "Yes - it's the only thing using gas" },
              { value: "no", label: "No - I also have gas cooking or heating" },
            ]}
            onPick={(v) => goNext({ isLastGasAppliance: v === "yes" })}
          />
        </Step>
      )}

      {currentStep === "cooktop" && (
        <Step title="What do you cook on?" onBack={goBack}>
          <ChoiceGrid
            options={COOKTOP_OPTIONS}
            onPick={(v) => goNext({ cooktop: v })}
          />
        </Step>
      )}

      {currentStep === "heating" && (
        <Step title="How do you heat the place in winter?" onBack={goBack}>
          <ChoiceGrid
            options={HEATING_OPTIONS}
            onPick={(v) => goNext({ heating: v })}
          />
        </Step>
      )}

      {currentStep === "rent" && (
        <Step title="What's your weekly rent?" onBack={goBack}>
          <p className="mb-4 text-sm text-stone-500">
            Optional - this unlocks the landlord deal calculator (a longer lease can cover the
            upgrade cost on its own). Skip if you&apos;d rather not say.
          </p>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const val = Number(rentInput);
              goNext({ weeklyRent: val > 0 ? val : undefined });
            }}
          >
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              placeholder="e.g. 650"
              value={rentInput}
              onChange={(e) => setRentInput(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Continue
            </button>
          </form>
          <button
            type="button"
            onClick={() => goNext({ weeklyRent: undefined })}
            className="mt-3 text-sm font-medium text-stone-500 underline hover:text-stone-700"
          >
            Skip this question
          </button>
        </Step>
      )}
    </div>
  );
}

function Step({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-5 text-xl font-semibold text-stone-900 sm:text-2xl">{title}</h2>
      {children}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-5 text-sm font-medium text-stone-500 hover:text-stone-700"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
