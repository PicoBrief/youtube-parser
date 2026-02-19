export const sleepAsync = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Race multiple attempts of the same async operation. Starts new attempts every
 * `waitTime` seconds and resolves as soon as any single attempt succeeds.
 */
export async function racePromises<T>(params: {
    generatePromise: () => Promise<T>;
    amount: number;
    waitTime: number;
    shouldRetry?: (e: any) => boolean;
}): Promise<T> {
    const { generatePromise, amount, waitTime } = params;
    const shouldRetry = params.shouldRetry ?? (() => false);

    if (amount <= 0) throw new Error("Amount of trials must be greater than 0");
    if (waitTime <= 0) throw new Error("waitTime must be greater than 0");

    const promises: Promise<any>[] = [];
    let lastAddedTime = 0;
    let canRetry = true;

    while (promises.length < amount && !(await hasAtLeastOneFulfilled(promises)) && canRetry) {
        const now = Date.now();
        if (now - lastAddedTime > waitTime * 1000) {
            const p = generatePromise();
            p.catch(async (e) => {
                canRetry = canRetry && shouldRetry(e);
                if ((await numPromisesInProgress(promises)) === 0) lastAddedTime = 0;
            });
            lastAddedTime = now;
            promises.push(p);
        }
        await sleepAsync(100);
    }

    return Promise.race(promises);
}

async function getPromiseStatus(promise: Promise<any>): Promise<"success" | "failed" | "in_progress"> {
    return new Promise((resolve) => {
        Promise.race([
            promise.catch(() => resolve("failed")),
            promise.then(() => resolve("success")),
            new Promise(() => setTimeout(() => resolve("in_progress"), 1)),
        ]).then((val) => resolve(val as any));
    });
}

async function numPromisesInProgress(promises: Promise<any>[]): Promise<number> {
    if (promises.length === 0) return 0;
    const statuses = await Promise.all(promises.map(getPromiseStatus));
    return statuses.filter((s) => s === "in_progress").length;
}

async function hasAtLeastOneFulfilled(promises: Promise<any>[]): Promise<boolean> {
    if (promises.length === 0) return false;
    const statuses = await Promise.all(promises.map(getPromiseStatus));
    return statuses.some((s) => s === "success");
}
