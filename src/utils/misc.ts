export function removeDuplicates<T>(arr: T[], evaluator: (data: T) => string | number): T[] {
    const seen = new Map<string | number, T>();
    for (const item of arr) seen.set(evaluator(item), item);
    return Array.from(seen.values());
}

export function isTrue(val: any): boolean {
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") {
        if (parseInt(val).toString() === val && parseInt(val) !== 0) return true;
        return ["t", "true", "yes"].includes(val.toLowerCase());
    }
    return false;
}

export function isJSON(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

export function getBaseLanguageCode(langCode: string | null | undefined): string | null {
    if (!langCode) return null;
    return langCode.split("-")[0] ?? null;
}

export function extractErrorMessage(e: any): string {
    if (e instanceof Error) {
        const err = e as any;
        if (err.errors?.length > 0) return err.errors[0].message ?? String(err.errors[0]);
        return e.message;
    }
    if (typeof e !== "string") return JSON.stringify(e);
    return e;
}
