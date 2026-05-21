// Singleton shared state — import this map in any module that tracks active calls.
// conv_id → { rowIndex, lead }
export const callsInProgress = new Map();
