export const boardConfig = {
  width: 7.2,
  height: 13.8,
  depth: 0.34,
  pegRows: 8,
  pegsInFirstRow: 5,
  pegSpacingX: 1.08,
  pegSpacingY: 1.12,
  pegRadius: 0.12,
  ballRadius: 0.22,
  slotCount: 5,
  slotMultipliers: [0.5, 1.2, 2, 1.2, 0.5],
  slotLabels: ['1', '2', '3', '4', '5'],
  slotColors: [0xf8f441, 0xff4fb2, 0xffc533, 0xff4fb2, 0xf8f441]
} as const;

export const economyConfig = {
  startingBalance: 100,
  bets: [1, 5, 10]
} as const;
