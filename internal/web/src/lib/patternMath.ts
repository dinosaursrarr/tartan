import { parseTdf, serialiseTdf, type TartanModel, type ThreadModel } from "./tdf";

export function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.trunc(a));
  let right = Math.abs(Math.trunc(b));
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

export function commonLengthFactor(model: TartanModel): number {
  const blocks = [...model.warp.blocks, ...(model.weft?.blocks ?? [])];
  return blocks.reduce((factor, block) => greatestCommonDivisor(factor, block.length), 0);
}

export function reduceModelToUnit(model: TartanModel): TartanModel {
  const divisor = commonLengthFactor(model);
  if (divisor <= 1) return model;
  const reduceThread = (thread: ThreadModel): ThreadModel => ({
    ...thread,
    blocks: thread.blocks.map((block) => ({ ...block, length: block.length / divisor })),
  });
  return {
    ...model,
    warp: reduceThread(model.warp),
    weft: model.weft ? reduceThread(model.weft) : null,
  };
}

export function normalisePattern(pattern: string): string {
  return serialiseTdf(reduceModelToUnit(parseTdf(pattern)));
}

export function doubleModelLengths(model: TartanModel): TartanModel {
  const scaleThread = (thread: ThreadModel): ThreadModel => ({
    ...thread,
    blocks: thread.blocks.map((block) => ({ ...block, length: block.length * 2 })),
  });
  return {
    ...model,
    warp: scaleThread(model.warp),
    weft: model.weft ? scaleThread(model.weft) : null,
  };
}

export function scalePatternToUnit(pattern: string): string {
  return normalisePattern(pattern);
}
