/**
 * Processes a list of raw optimization combinations to find the top 5 for each strategy.
 * @param allCombinations The full array of result objects (e.g., the top 100 from a run).
 * @returns An object where keys are strategy names and values are arrays of the top 5 results for that strategy.
 */
export function getTopResultsByStrategy(allCombinations: any[]) {
  if (!allCombinations || allCombinations.length === 0) {
    return {};
  }

  const firstResult = allCombinations[0];
  const strategyNames = Object.keys(firstResult.metrics || {});
  const topResultsByStrategy: { [key: string]: any[] } = {};

  for (const name of strategyNames) {
    // Create a new sorted array for each strategy, based on its specific score
    const sortedForStrategy = [...allCombinations].sort((a, b) => {
      const scoreA = a.strategyScores?.[name] ?? -Infinity;
      const scoreB = b.strategyScores?.[name] ?? -Infinity;
      return scoreB - scoreA;
    });
    
    // Get the top 5 and store them
    topResultsByStrategy[name] = sortedForStrategy.slice(0, 5);
  }

  return topResultsByStrategy;
}