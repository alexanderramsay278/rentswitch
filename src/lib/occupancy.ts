/**
 * Rentswitch - bounded range for households above two people.
 *
 * The engine assumes hot water demand is linear in occupants (45 L/person/day, the NSW ESS
 * modelling figure). The AER metered benchmarks in data/validation_aer.json show real
 * households are sub-linear: five people use 2.93x the gas of one person, not 5.00x.
 *
 * Those ratios come from TOTAL household gas, which includes cooking and space heating, so
 * they are not a calibration of hot water demand. They set a conservative floor. The results
 * page quotes that floor as its single figure, labelled as conservative, and states the
 * engine's linear figure (the upper bound) next to it; it never presents the floor as a best
 * estimate. At one and two occupants the model sits inside the defensible range and the
 * linear figure is used as is.
 */

import { calculate, type Constants, type Inputs, type Result, type Tariffs } from "./engine.ts";
import validation from "../../data/validation_aer.json" with { type: "json" };

/** Occupants -> AER metered total gas relative to a one-person household. */
const AER_RELATIVE_TO_ONE: Map<number, number> = (() => {
  const rows = validation.results;
  const base = rows.find((r) => r.occupants === 1);
  if (!base) {
    throw new Error("Rentswitch occupancy: data/validation_aer.json has no one-person row.");
  }
  return new Map(rows.map((r) => [r.occupants, r.aer_total_gas_mj / base.aer_total_gas_mj]));
})();

/** Above this many occupants the linear model is reported as an upper bound. */
export const SINGLE_FIGURE_MAX_OCCUPANTS = 2;

export interface OccupancyRange {
  /** Demand scaled by the AER metered ratio. */
  lower: Result;
  /** The engine's linear figure. */
  upper: Result;
  /** The AER ratio used for the lower bound, e.g. 2.03 for three people. */
  ratio: number;
}

/**
 * Returns a lower and upper result for households above two people, or null when a single
 * figure is reported. Useful energy is linear in occupants, so running the engine with the
 * AER ratio in place of the head count scales demand to the metered curve and nothing else.
 */
export function occupancyRange(c: Constants, t: Tariffs, input: Inputs): OccupancyRange | null {
  if (input.occupants <= SINGLE_FIGURE_MAX_OCCUPANTS) return null;
  const ratio = AER_RELATIVE_TO_ONE.get(input.occupants);
  if (ratio === undefined) return null;
  return {
    lower: calculate(c, t, { ...input, occupants: ratio }),
    upper: calculate(c, t, input),
    ratio,
  };
}
