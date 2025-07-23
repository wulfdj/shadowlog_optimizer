// These are the same helpers we created for HistoryView, now reused here.
export function getPredefinedFilter(config: any, filterName: 'Setup' | 'Session'): string | null {
    const filters = config.settings?.predefinedFilters || [];
    const found = filters.find((f: any) => f.columnHeader === filterName);
    return found ? found.condition : null;
}