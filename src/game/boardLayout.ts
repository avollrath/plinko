import { boardConfig } from '../config';
import type { SlotResult } from '../types';

export type Point2 = {
  x: number;
  y: number;
};

export function getPegPositions(): Point2[] {
  const positions: Point2[] = [];
  for (let row = 0; row < boardConfig.pegRows; row += 1) {
    const count = boardConfig.pegsInFirstRow + (row % 2);
    const rowWidth = (count - 1) * boardConfig.pegSpacingX;
    const y = 4.55 - row * boardConfig.pegSpacingY;
    for (let index = 0; index < count; index += 1) {
      positions.push({
        x: index * boardConfig.pegSpacingX - rowWidth / 2,
        y
      });
    }
  }
  return positions;
}

export function getSlotCenters(): Point2[] {
  const slotWidth = boardConfig.width / boardConfig.slotCount;
  return Array.from({ length: boardConfig.slotCount }, (_, index) => ({
    x: -boardConfig.width / 2 + slotWidth * (index + 0.5),
    y: -6.28
  }));
}

export function getSlotForX(x: number): SlotResult {
  const slotWidth = boardConfig.width / boardConfig.slotCount;
  const normalized = (x + boardConfig.width / 2) / slotWidth;
  const index = Math.max(0, Math.min(boardConfig.slotCount - 1, Math.floor(normalized)));
  return {
    index,
    label: boardConfig.slotLabels[index],
    multiplier: boardConfig.slotMultipliers[index]
  };
}
